

// //=========================================
// // - ถ้า Login แล้วให้ไปต่อ 
// // - ถ้ายังให้ไปที่หน้า Login
// const isAuthOwner = (req, res, next) => { 
//   console.log("isAuthOwner ===>", req.session.isAuth, req.session.userAuthority)
//   if(req.session.isAuth && req.session.userAuthority == 'O'){
//     next()
//   }else{
//     res.redirect("/")    
//   }
// }

// module.exports = isAuthOwner


// // const logger = (req, res, next) => {
// //   const url_parts = url.parse(req.url, true);
// //   const host =  req.get('host');
// //   const path = url_parts.pathname;
// //   const nowLocal =  mm.nowLocal()
// //   console.log(`${host}_${path}_${ nowLocal }`)
  
// //   const client = new MongoClient(dbUrl);
// //   const main = async () => {
// //     await client.connect()
// //     const db = client.db(dbName)
// //     const collection = db.collection(dbColl_visits)
// //     await collection.insertOne({
// //       host: host,
// //       path: path,
// //       now:new Date() ,
// //       nowLocal:nowLocal ,
// //     })
// //     //=== ห้ามลบ === เก็บไว้ดู === เอา id ที่ insert มาใช้ต่อได้
// //     // const insertResult = await collection.insertOne(v);
// //     // console.log('Inserted documents =>',  insertResult) ;
// //   }
// //   main().then( () =>     { next()         })
// //         .catch( (err) => { next(err)      })
// //         .finally( () =>  { client.close() })
// // }

// // module.exports = logger