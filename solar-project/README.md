# Solar Project


## Getting start

1. Make sure mysql is set up
2. Make sure MongoDB is set up
3. Make changes to .env.dev file 

```
MONGODB_URI=mongodb://localhost:27017/solar_project

MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
```

4. `npm install`

5. `npm start`

### Set up MYSQL

1. Make changes to the `.env.dev`
2. Create a database name 'solar_project'

```
mysql -u {USERNAME} -p # This will bring you into the MySQL shell prompt. Next, create a new database with the following command
  mysql> CREATE DATABASE solar_project;
  mysql> exit;
```

3. unzip the `./artifacts/solar_project.zip`
4. Run `mysql -u {USERNAME} -p solar_project < ./artifacts/solar_project.sql`
