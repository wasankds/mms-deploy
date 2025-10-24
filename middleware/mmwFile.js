

// const { MongoClient } = require('mongodb');
// const url = require('url');
// const mm = require("../mymodule/myDateTime.js")

// const mmw = {

//   //=================================
//   // - ถ้า Login แล้วให้ไปต่อ 
//   // - ถ้ายังให้ไปที่หน้า Login
//   isAuth : (req, res, next) => {
//     console.log("mmw.isAuth ===>", req.session.isAuth)
//     if(req.session.isAuth){
//       next()
//     }else{
//       req.flash('msg', {
//         class : "red", 
//         text : 'คุณยังไม่ได้ Login'
//       })
//       res.redirect("/")
//     }
//   },

//   //=================================
//   // Login ในฐานะ Owner หรือไม่
//   isAuthOwner : (req, res, next) => {
//     // console.log("mmw.isAuthOwner.userAuthority ===>", req.session.userAuthority)
//     console.log("mmw.isAuthOwner.isAuth ===>", req.session.isAuth)
//     const authorizeArr = ["O"]
//     if(req.session.isAuth && authorizeArr.includes(req.session.userAuthority)){
//       next()
//     }else{
//       req.flash('msg', {
//         class : "red", 
//         text : 'เฉพาะผู้ใช้งานระดับ Owner เท่านั้น'
//       })
//       res.redirect("/")    
//     }
//   },

//   //=================================
//   // Login ในฐานะ Admin/Owner หรือไม่
//   // 
//   isAuthAdmin : (req, res, next) => {
//     // console.log("mmw.isAuthOwner.userAuthority ===>", req.session.userAuthority)
//     console.log("mmw.isAuthAdmin.isAuth ===>", req.session.isAuth)
//     const authorizeArr = ["O","A"]
//     if(req.session.isAuth && authorizeArr.includes(req.session.userAuthority)){
//       next()
//     }else{
//       req.flash('msg', {
//         class : "red", 
//         text : 'เฉพาะผู้ใช้งานระดับ Admin/Owner เท่านั้น'
//       })
//       res.redirect("/")    
//     }
//   },

//   logger : (req, res, next) => {
//     const url_parts = url.parse(req.url, true);
//     const host =  req.get('host');
//     const path = url_parts.pathname;
//     const nowLocal =  mm.nowLocal()
//     console.log(`${host}_${path}_${ nowLocal }`)

//     const client = new MongoClient(dbUrl);
//     const main = async () => {
//       await client.connect()
//       const db = client.db(dbName)
//       const collection = db.collection(dbColl_visits)
//       await collection.insertOne({
//         host: host,
//         path: path,
//         now:new Date() ,
//         nowLocal:nowLocal ,
//       })
//     }
//     main().then( () =>     { next()         })
//           .catch( (err) => { next(err)      })
//           .finally( () =>  { client.close() })
//   },

//   //=== ถ้า Login แล้ว ถ้าจะมาที่หน้า login อีก -> ให้ไปที่หน้าแรกเลย
//   isLogged : (req, res, next) => {
//     if(req.session.isAuth){    
//       req.flash('msg', {
//         class : "blue", 
//         text : 'คุณ Login เรียบร้อยแล้ว' ,
//       })
//       res.redirect("/")
//     }else{
//       next()
//     }
//   }
  
// }

// module.exports = mmw