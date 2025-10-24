

// //=========================================
// // - ถ้า Login แล้วให้ไปต่อ 
// // - ถ้ายังให้ไปที่หน้า Login
// const isAuthUser = (req, res, next) => { 
//   console.log("isAuthUser ===>", req.session.isAuth)
//   if(req.session.isAuth){
//     next()
//   }else{
//     // req.flash('msg', 'No authorised user.')
//     res.redirect("/")    
//   }
// }

// // //=========================================
// // // - ถ้า Login แล้วให้ไปต่อ 
// // // - ถ้ายังให้ไปที่หน้า Login
// // const isAuthOwner = (req, res, next) => { 
// //   console.log("isAuthOwner ===>", req.session.isAuth)
// //   console.log("isAuthOwner ===>", req.session.userAuthority)
// //   if(req.session.isAuth && req.session.userAuthority == 'O'){
// //     next()
// //   }else{
// //     res.redirect("/")    
// //   }
// // }

// module.exports = isAuthUser
// // module.exports = isAuthOwner
