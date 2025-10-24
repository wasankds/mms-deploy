
// import { MongoClient } from 'mongodb'
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// // import { ObjectId } from 'mongodb';  
// // import url from 'url';
// // import fs from 'fs'; // Import fs for file operations

// const mauth = {

//   //=================================
//   // - ถ้า Login แล้วให้ไปต่อ 
//   // - ถ้ายังให้ไปที่หน้า Login
//   isAuth : (req, res, next) => {
//     if(req.session.sessionIsAuth){
//       next()
//     }else{
//       console.log("คุณยังไม่ได้ Login")
//       req.flash('msg', { class : "red", text : 'คุณยังไม่ได้ Login'})
//       res.redirect("/login")
//     }
//   },

//   //=== ถ้า Login แล้ว ถ้าจะมาที่หน้า login อีก -> ให้ไปที่หน้าแรกเลย
//   isLogged: (req, res, next) => {
//     if (req.session.sessionIsAuth) {
//       req.flash('msg', {class: "blue", text: 'คุณ Login เรียบร้อยแล้ว',})
//       res.redirect("/")
//     } else {
//       next()
//     }
//   },
  
//   //=================================
//   // Login ในฐานะ Owner หรือไม่
//   isO : async (req, res, next) => {
//     const sessionUser_id = req.session.sessionUser_id
//     const userAuthority = await myUsers.getUserAuthorityByUserId(sessionUser_id)
//     const authorizeArr = ["MO"]
//     if (userAuthority && authorizeArr.includes(userAuthority)) {
//       next()
//     } else {
//       req.flash('msg', { class: "red",text: 'เฉพาะผู้ใช้งานระดับ MO เท่านั้น'});
//       res.redirect("/")
//     }
//   },

//   //=================================
//   // Login ในฐานะ Admin/Owner หรือไม่
//   //
//   isOA: async (req, res, next) => {
//     const sessionUser_id = req.session.sessionUser_id
//     const userAuthority = await myUsers.getUserAuthorityByUserId(sessionUser_id)
//     const authorizeArr = ["MO","MA"]
//     if (userAuthority && authorizeArr.includes(userAuthority)) {
//       next()
//     } else {
//       req.flash('msg', { class: "red",text: 'เฉพาะผู้ใช้งานระดับ MO/MA เท่านั้น'})
//       res.redirect("/")
//     }
//   },

//   logger: async (req, res, next) => {
//     // const url_parts = url.parse(req.url, true)
//     const host = req.get('host')
//     const path = req.originalUrl
//     const nowLocal = myDateTime.nowLocal()

//     //==== เก็บลงไฟล์ Log แบบต่อๆกันไป *** ห้ามลบ ***
//     // try {
//     //   const logData = {
//     //     method: req.method,
//     //     url: req.url,
//     //     headers: req.headers,
//     //     query: req.query,
//     //     params: req.params,
//     //     body: req.body,   
//     //     host: host,
//     //     path: path,
//     //     originalUrl: req.originalUrl,
//     //     nowLocal: nowLocal,      
//     //   }
//     //   const logString = `\n---------------------\n${nowLocal}\nHost: ${host}\nPath: ${path}\n\nRequest Details:\n${JSON.stringify(logData, null, 2)}`;             
//     //   await fs.promises.appendFile('request.log', logString, 'utf-8');
//     // }catch (error) {
//     //   console.error("Error writing to log file: ", error);
//     // }

//     const client = new MongoClient(dbUrl);
//     const main = async () => {
//       await client.connect();
//       const db = client.db(dbName);
//       const collection = db.collection(dbColl_visits);
//       await collection.insertOne({
//         host: host,
//         path: path,
//         nowLocal: nowLocal,
//       });
//     };
//     main().then(() => {
//             next()
//           }).catch((err) => {
//             next(err)
//           }).finally(() => {
//             client.close()
//           })
//   },
// }

// export default mauth




// // const { MongoClient } = require('mongodb');
// // const url = require('url');
// // const mm = require("../mymodule/mymodule.js")

// // const mauth = {

// //   //=================================
// //   // - ถ้า Login แล้วให้ไปต่อ 
// //   // - ถ้ายังให้ไปที่หน้า Login
// //   sessionIsAuth : (req, res, next) => {
// //     console.log("mauth.sessionIsAuth ===>", req.session.sessionIsAuth)
// //     if(req.session.sessionIsAuth){
// //       next()
// //     }else{
// //       req.flash('msg', {
// //         class : "red", 
// //         text : 'คุณยังไม่ได้ Login'
// //       })
// //       res.redirect("/")
// //     }
// //   },

// //   //=================================
// //   // Login ในฐานะ Owner หรือไม่
// //   isAuthOwner : (req, res, next) => {
// //     console.log("mauth.isAuthOwner.sessionIsAuth ===>", req.session.sessionIsAuth)
// //     const authorizeArr = ["O"]
// //     if(req.session.sessionIsAuth && authorizeArr.includes(req.session.userAuthority)){
// //       next()
// //     }else{
// //       req.flash('msg', {
// //         class : "red", 
// //         text : 'เฉพาะผู้ใช้งานระดับ Owner เท่านั้น'
// //       })
// //       res.redirect("/")    
// //     }
// //   },

// //   //=================================
// //   // Login ในฐานะ Admin/Owner หรือไม่
// //   // 
// //   isAuthAdmin : (req, res, next) => {
// //     // console.log("mauth.isAuthOwner.userAuthority ===>", req.session.userAuthority)
// //     console.log("mauth.isAuthAdmin.sessionIsAuth ===>", req.session.sessionIsAuth)
// //     const authorizeArr = ["O","A"]
// //     if(req.session.sessionIsAuth && authorizeArr.includes(req.session.userAuthority)){
// //       next()
// //     }else{
// //       req.flash('msg', {
// //         class : "red", 
// //         text : 'เฉพาะผู้ใช้งานระดับ Admin/Owner เท่านั้น'
// //       })
// //       res.redirect("/")    
// //     }
// //   },

// //   logger : (req, res, next) => {
// //     const url_parts = url.parse(req.url, true);
// //     const host =  req.get('host');
// //     const path = url_parts.pathname;
// //     const nowLocal =  mm.nowLocal()
// //     console.log(`${host}_${path}_${ nowLocal }`)

// //     const client = new MongoClient(dbUrl);
// //     const main = async () => {
// //       await client.connect()
// //       const db = client.db(dbName)
// //       const collection = db.collection(dbColl_visits)
// //       await collection.insertOne({
// //         host: host,
// //         path: path,
// //         now:new Date() ,
// //         nowLocal:nowLocal ,
// //       })
// //     }
// //     main().then( () =>     { next()         })
// //           .catch( (err) => { next(err)      })
// //           .finally( () =>  { client.close() })
// //   },

// //   //=== ถ้า Login แล้ว ถ้าจะมาที่หน้า login อีก -> ให้ไปที่หน้าแรกเลย
// //   isLogged : (req, res, next) => {
// //     if(req.session.sessionIsAuth){    
// //       req.flash('msg', {
// //         class : "blue", 
// //         text : 'คุณ Login เรียบร้อยแล้ว' ,
// //       })
// //       res.redirect("/")
// //     }else{
// //       next()
// //     }
// //   }
  
// // }

// // module.exports = mauth