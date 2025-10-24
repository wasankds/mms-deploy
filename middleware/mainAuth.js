
// import { MongoClient } from 'mongodb'
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import { ObjectId } from 'Ongodb';  
// import url from 'url';
// import fs from 'fs'; // Import fs for file operations

const mauth = {

  //=================================
  // - ถ้า Login แล้วให้ไปต่อ 
  // - ถ้ายังให้ไปที่หน้า Login
  isAuth : (req, res, next) => {
    if(req.session.isAuth){
      next()
    }else{
      console.log("คุณยังไม่ได้ Login")
      req.flash('msg', { class : "red", text : 'คุณยังไม่ได้ Login'})
      res.redirect("/login")
    }
  },

  //=== ถ้า Login แล้ว ถ้าจะมาที่หน้า login อีก -> ให้ไปที่หน้าแรกเลย
  isLogged: (req, res, next) => {
    if (req.session.isAuth) {
      req.flash('msg', {class: "blue", text: 'คุณ Login เรียบร้อยแล้ว',})
      res.redirect("/")
    } else {
      next()
    }
  },
  
  //=================================
  // Login ในฐานะ Owner หรือไม่
  isO : async (req, res, next) => {
    const userAuthority = req.session.userAuthority
    const authorizeArr = ["O"]
    if (userAuthority && authorizeArr.includes(userAuthority)) {
      next()
    } else {
      req.flash('msg', { class: "red",text: 'เฉพาะผู้ใช้งานระดับ O เท่านั้น'});
      res.redirect("/")
    }
  },



  // //=================================
  // // - ไม่ได้ใช้แล้ว
  // isOS : async (req, res, next) => {
  //   const userAuthority = req.session.userAuthority
  //   const authorizeArr = ["O", "S"]
  //   if (userAuthority && authorizeArr.includes(userAuthority)) {
  //     next()
  //   } else {
  //     req.flash('msg', { class: "red",text: 'เฉพาะผู้ใช้งานระดับ O/S เท่านั้น'});
  //     res.redirect("/")
  //   }
  // },

  //=================================
  // Login ในฐานะ Admin/Owner หรือไม่
  //
  isOA: async (req, res, next) => {
    const userAuthority = req.session.userAuthority
    const authorizeArr = ["O","A"]
    if (userAuthority && authorizeArr.includes(userAuthority)) {
      next()
    } else {
      req.flash('msg', { class: "red",text: 'เฉพาะผู้ใช้งานระดับ O/A เท่านั้น'})
      res.redirect("/")
    }
  },

  // logger: async (req, res, next) => {
  //   // const url_parts = url.parse(req.url, true)
  //   const host = req.get('host')
  //   const path = req.originalUrl
  //   const nowLocal = myDateTime.nowLocal()
  //   const client = new MongoClient(dbUrl);
  //   const main = async () => {
  //     await client.connect();
  //     const db = client.db(dbName);
  //     const collection = db.collection(dbColl_visits);
  //     await collection.insertOne({
  //       host: host,
  //       path: path,
  //       nowLocal: nowLocal,
  //     });
  //   };
  //   main().then(() => {
  //           next()
  //         }).catch((err) => {
  //           next(err)
  //         }).finally(() => {
  //           client.close()
  //         })
  // },

}

export default mauth




// const { MongoClient } = require('Ongodb');
// const url = require('url');
// const mm = require("../mymodule/mymodule.js")

// const mauth = {

//   //=================================
//   // - ถ้า Login แล้วให้ไปต่อ 
//   // - ถ้ายังให้ไปที่หน้า Login
//   isAuth : (req, res, next) => {
//     console.log("mauth.isAuth ===>", req.session.isAuth)
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
//     console.log("mauth.isAuthOwner.isAuth ===>", req.session.isAuth)
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
//     // console.log("mauth.isAuthOwner.userAuthority ===>", req.session.userAuthority)
//     console.log("mauth.isAuthAdmin.isAuth ===>", req.session.isAuth)
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

// Odule.exports = mauth


  // //=================================
  // // Login ในฐานะ Owner หรือไม่
  // isOSA : async (req, res, next) => {
  //   const userAuthority = req.session.userAuthority
  //   const authorizeArr = ["O","S","A"]
  //   if (userAuthority && authorizeArr.includes(userAuthority)) {
  //     next()
  //   } else {
  //     req.flash('msg', { class: "red",text: 'เฉพาะผู้ใช้งานระดับ O/S/A เท่านั้น'});
  //     res.redirect("/")
  //   }
  // },