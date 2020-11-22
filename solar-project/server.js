const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const cors = require('cors');
const db = require('./sql_db');
const mongo = require('./mongo');
const app = express();


/**
 * Load environment variables from .env file.
 */
require('dotenv').config({ path: process.env.pro ? '.env' : '.env.dev' });
const log = require('Debug')('app');

log(process.env.pro ? chalk.red('Production Mode') : chalk.yellow('Development Mode'));

//set secret
app.set('Secret', process.env.SECRET);
app.set('view engine', 'ejs');


let state_station_cache, misc_cache;
async function get_mongo_conn() {
    let conn;
    try{
        conn = await mongo.conn();
    } catch (error) {
        log(error);
        log(chalk.red(`MongoDB connection error. Please make sure MongoDB is running`)); 
    }
    //initalize cache here
    state_station_cache = await new mongo.MongoCache(conn, { mongo_collection_name: "state_station_cache", time_to_live: 50 }).init();
    misc_cache = await new mongo.MongoCache(conn, {
        mongo_collection_name: "misc_cache", time_to_live: 1000
    }).init();
    return conn;
}


let mongo_conn = (async () => await get_mongo_conn())();



db.conn.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
    if (error) {
        log(error);
        log(chalk.red(`
Mysql connection error. Please make sure Mysql is running. And following step is done
 1. Make changes to .env.dev file
 2. Create a database name 'solar_project'
    mysql -u {USERNAME} -p # This will bring you into the MySQL shell prompt. Next, create a new database with the following command
    mysql> CREATE DATABASE solar_project;
    mysql> exit;
3. unzip the ./artifacts/solar_project.zip
4. Run 'mysql -u {USERNAME} -p solar_project < ./artifacts/solar_project.sql'    
`));
        process.exit();
    }
});

/**
 * log only 4xx and 5xx responses to console
 * log all requests to access.log
 */
app.use(morgan('dev', { skip: (req, res) => res.statusCode < 400 }));
app.use(morgan('common', { stream: fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' }) }));
app.use(express.static(__dirname + '/public'));

//https://stackoverflow.com/questions/20035101/why-does-my-javascript-code-get-a-no-access-control-allow-origin-header-is-pr
// allow access from any where
app.use(cors());

function log_request(req, str) {
    log(`${chalk.yellow(req.originalUrl)}: ${str}`)
}

app.get('/clearcache', async (req, res) => {
    await state_station_cache.clear();
    await misc_cache.clear();
    return res.status(200).send("OK");
});

// index page
app.get('/', async function (req, res) {
    log_request(req, "Request main page")
    const STATES_CACHE_KEY = "all state in the us - unique key";
    let getStates = async () => await db.query("SELECT * FROM state");
    let states = await misc_cache.get(STATES_CACHE_KEY, getStates)

    let getGHIlatlong = async () => await db.query("SELECT station_recording.station_code,YEAR(station_recording.date) as 'year', SUM(`DNI (W/m^2)`) as DNI_sum, station.latitude, station.longitude FROM station_recording join station on station.code = station_recording.station_code GROUP BY YEAR(date), station_code;");
    const STN_CACHE_KEY = "all stations summarized by yearly GHI sum & lat-lon";
    let stnInfo = await misc_cache.get(STN_CACHE_KEY, getGHIlatlong);

    let getFeaturedStations = async () => await db.query(`SELECT s.* FROM station_recording sr
        INNER JOIN station s ON s.code=sr.station_code
        GROUP BY sr.station_code    
    `);
    let featuredStations = await misc_cache.get("featured station UNIQUE key", getFeaturedStations);

    res.render('pages/index', { ejsD: { state: states.value,
                                        stnData: stnInfo.value, 
                                        featuredStations: featuredStations.value },});
                                    });


app.get('/_api/state/:state/stations', async (req, res) => {
    if (!req.params.state) {
        return res.status(400).send("Invalid");
    }
    log_request(req, `Request stations from state - ${req.params.state}`);
    let getStations = async () => await db.query("SELECT * FROM station WHERE state=?", [req.params.state]);
    let stations = await state_station_cache.get(req.params.state, getStations);
    res.status(200).send({ stations: stations.value });
});

app.listen(process.env.PORT, () => {
    log(chalk.bold('Server is up and running on ' + process.env.BASE_URL));
});