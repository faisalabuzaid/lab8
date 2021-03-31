'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pg = require('pg');
const superagent = require('superagent');
const PORT = process.env.PORT;
const app = express();


const client = new pg.Client(process.env.DATABASE_URL);
client.on('error', err => console.log("PG PROBLEM!!!") );

app.get('/location', handleLocation);

app.get('/weather', handleWeather)

app.get('/park', handleParks);

// app.use('*', noExist);
// app.use(errorHandler);
// function noExist(request, response) {
//   response.status(404).send('Error 404, Page Not Found!');
// }
// function errorHandler(err, request, response) {
//   response.status(500).send('Error 500, Server Internal Error');
// }

function handleParks (request, response) {
  let key = process.env.PARK_API_KEY;
  let url = `https://developer.nps.gov/api/v1/parks?api_key=${key}`;

  superagent.get(url).then(res => {
    let info = res.body.data;
    info.forEach(element => {
      let url = element.url;
      let name = element.fullName;
      let description = element.description;
      let fees = '0.0';
      let address = element.addresses[0].line1 + ', ' + element.addresses[0].city + ', ' + element.addresses[0].stateCode + ' ' + element.addresses[0].postalCode;
      new Park(name, address, fees, description, url);

    });
    response.send(allArr);
  })

}

let allArr = [];
function Park(name,address,fees,description,url){
  this.name = name;
  this.address = address;
  this.fee = this.fees;
  this.description = description;
  this.url = url;
  allArr.push(this);
}


let lat;
let lon;
function handleLocation(request, response) {
  let city = request.query.city;
  const SQL ='SELECT * FROM location where search_query=$1'

  client.query(SQL, [city]).then(result=> {
    if (result.rowCount>0) {
      console.log('here from DB', result.rows[0]);
      response.send(result.rows[0]);
    } else {
      let key = process.env.GEO_API_KEY;
      const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${city}&format=json`;
      superagent.get(url).then(res=> {
        const locationData = res.body[0];
        const location = new Location(city, locationData);
        console.log(location);
        lat=locationData.lat;
        lon=locationData.lon;
        const SQL = 'INSERT INTO location (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) RETURNING *';
        let values = [city, locationData.display_name, locationData.lat, locationData.lon];
        client.query(SQL, values).then(result=> {
          console.log('here from API', location);
          response.send(location);
        });
              }).catch((err)=> {
        console.log('ERROR IN LOCATION API');
        console.log(err)
      });
    }
});

  
}
function Location(city, geoData) {
  this.search_query = city;
  this.formatted_query = geoData.display_name;
  this.latitude = geoData.lat;
  this.longitude = geoData.lon;
}


let myLocalWeather = {};
function handleWeather(request, response) {
  let city = request.query.city;
  if (myLocalWeather[city]) {
    response.send(myLocalWeather[city]);
  } else {
    let obj={};
    let newArr =[];
    let key = process.env.WETH_API_KEY;
    const url = `https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&key=${key}`;
    superagent.get(url).then(res => {
      let data = res.body.data;
      console.log(data);
      data.forEach(item => {
        obj = {
          'forecast': item.weather.description,
          'time': item.valid_date
        }
        newArr.push(obj);
      })

      response.send(newArr);
    })
  }
}



client.connect().then(
  app.listen(process.env.PORT, ()=> console.log(`App is running on Server on port: ${PORT}`))
);

app.use(cors());
