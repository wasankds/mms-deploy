
// const { MongoClient } = require('mongodb');
// const url = require('url');
// const mm = require("../mymodule/mymodule.js")
// // 
// const logger = (req, res, next) => {
//   const url_parts = url.parse(req.url, true);
//   const host =  req.get('host');
//   const path = url_parts.pathname;
//   const nowLocal =  mm.nowLocal()
//   console.log(`${host}_${path}_${ nowLocal }`)
  
//   const client = new MongoClient(dbUrl);
//   const main = async () => {
//     await client.connect()
//     const db = client.db(dbName)
//     const collection = db.collection(dbColl_visits)
//     await collection.insertOne({
//       host: host,
//       path: path,
//       now:new Date() ,
//       nowLocal:nowLocal ,
//     })
//     //=== ห้ามลบ === เก็บไว้ดู === เอา id ที่ insert มาใช้ต่อได้
//     // const insertResult = await collection.insertOne(v);
//     // console.log('Inserted documents =>',  insertResult) ;
//   }
//   main().then( () =>     { next()         })
//         .catch( (err) => { next(err)      })
//         .finally( () =>  { client.close() })
// }

// module.exports = logger






// //***** ห้ามลบ *****/
// //***** แบบใช้ Mongoose - ไม่มีปิด connection *****/
// //***** ห้ามลบ *****/
// // const mongoose = require('mongoose')
// // const Visit = require('../models/Visit.js');
// // const dbUrl = 'mongodb://localhost:27017/visitDB'
// // // mongoose.Promise = global.Promise
// // mongoose.connect(dbUrl)
// //         .then( () => console.log("MongoDB connected"))
// //         .catch( (err) => console.error(err))

// // const logger = (req, res, next) => {
// //   console.log(`${req.protocol}://${req.get('host')}${req.originalUrl}__${new Date().toISOString()}`)
// //   const v = {
// //     host: req.get('host'),
// //     path: req.path,
// //   }

// //   //=== เขียนลงฐานข้อมูล
// //   Visit.create(v).then( post => {
// //     // mongoose.connection.close()
// //     next()   // next(req.originalUrl) // ใช้ไม่ได้
// //   }).catch( (err) => {
// //     return next(err);
// //   })
// // }