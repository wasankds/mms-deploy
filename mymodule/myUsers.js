// import fs from 'fs'
// import path  from 'path'
import { MongoClient } from 'mongodb';

//================================================
// จับข้อมูล User จากฐาน session
// - ถ้ามีการแก้ไขข้อมูลยูสซเอร์ ถ้าเขียนไม่ไดี อาจไม่ได้ข้อมูลที่เปลี่ยนแปลงแล้ว
export function getSessionData(req) {
  return {
    isAuth: req.session.isAuth || false,
    user_id: req.session.user_id || null,
    userId: req.session.userId || null,
    userAuthority: req.session.userAuthority || null,
    username: req.session.username || null,
    userEmail : req.session.userEmail || null,
    userFullname: req.session.userFullname || null,
    // branchId: req.session.branchId || null,
    // branchName: req.session.branchName || null,
  }
}


//================================================
// จับข้อมูล User จากฐานข้อมูล
// 
export async function getUserData(req) {
  const userId = req.session.userId;
  const isAuth = req.session.isAuth
  const client = new MongoClient(global.dbUrl);
  try {
    await client.connect();
    const db = client.db(global.dbName);
    const coll_users = db.collection(global.dbColl_users);
    // const coll_usersBranches = global.dbColl_userBranches

    const agg = [
      { $match: { userId: userId } },
      { $project: {
          _id: 1,
          user_id: { $toString: "$_id" }, // แปลง ObjectId เป็น string
          userIsActive: 1,
          userId: 1,
          userAuthority: 1,
          username: 1,
          userPrefix: 1,
          userFirstname: 1,
          userLastname: 1,
          userFullname: { $concat: ["$userPrefix"," ","$userFirstname"," ","$userLastname"] },
          userEmail: 1,
          userPhone: 1,
          // branchId: 1,
        }
      },
      // { // Lookup branch information
      //   $lookup: {
      //     from: coll_usersBranches,
      //     localField: "branchId",
      //     foreignField: "branchId",
      //     as: "branchInfo"
      //   }
      // },
      // { // Add branch name field
      //   $addFields: {
      //     branchName: { $arrayElemAt: ["$branchInfo.branchName", 0] }
      //   }
      // },
      // { $project: { branchInfo: 0 } }
    ];
    const result = await coll_users.aggregate(agg).toArray();    

    if(result.length > 0) {      
      const user = result[0]
      user.isAuth = isAuth || false
      // console.log("user ===> ", user)
      return user
    }else{      
      req.session.destroy( err => {
        if(err) console.log("Error destroy session ===> " , err.message)
        return res.redirect('/login')
      })
      return null
    }
  } catch (err) {
    console.log(err);
    throw err;
  } finally {
    client.close();
  }
}



// //================================================
// // จับภาพลายเซ็นเป็น base64 ตาม userId ที่ส่งมา
// // 
// export function getUser_sign(userId) {
//   // จับลายเซ็นด้วย
//   const userImageSignatureFilename = path.join(
//     global.folderUsers, 
//     `${userId}${global.SIGNATURE_SUFFIX}.png`
//   )
//   if (fs.existsSync(userImageSignatureFilename)) {
//     // อ่านภาพเป็น base64 สำหรับแสดงในอิเล็มเม้นต์img
//     const imageBuffer = fs.readFileSync(userImageSignatureFilename)
//     const base64Image = imageBuffer.toString('base64')
//     // เตรียมพร้อมแสดงใน img
//     var userImageSignature_Src = `data:image/png;base64,${base64Image}`
//     // ฝังรวมกับ userToLoad
//   }else{
//     var userImageSignature_Src = null
//   }
//   return userImageSignature_Src
// }



// import { MongoClient } from 'mongodb';
// import { ObjectId } from 'mongodb';  


// //================================================
// // จับข้อมูล User จากฐานข้อมูลโดยใช้ ObjectId
// export async function getUserById(user_d) {
//   if(!user_d){
//     return {
//       userIsActive : null,
//       userEmail : null,
//       userAuthority : null,
//       userApps : [] ,
//     }
//   }

//   const client = new MongoClient(dbUrl);
//   try{
//     await client.connect()
//     const db = client.db(dbName)
//     const coll_users = db.collection(dbColl_users)

//     //=== ค้นหา User
//     const userInSession = await coll_users.findOne(
//       { 
//         _id:  new ObjectId(user_d) , 
//         userIsActive :'active' 
//       },
//       { projection: { 
//           _id:1,
//           username:1,
//           userId:1,
//           userIsActive:1,
//           userFullname: { $concat: ["$userPrefix"," ","$userFirstname"," ","$userLastname"] },
//           userEmail:1,
//           userOrganization:1,
//           userAuthority:1,
//           userApps:1,
//         } 
//       },
//     )
    

//     //=== ถ้ามี userInSession
//     // - Lookup เอารายละเอียดของ app มาใส่ใน userApps
//     if(userInSession && userInSession.userApps && userInSession.userApps.length > 0){
//       userInSession.userApps = userInSession.userApps.map( obj => {
//         obj['appInfo'] = APPS.find( app => app.ID === obj.appId)
//         return obj
//       })
//     }

//     return {
//       userIsActive:userInSession.userIsActive??'-',
//       _id : userInSession._id?.toString(),
//       userId : userInSession.userId,
//       username : userInSession.username,
//       userFullname : userInSession.userFullname,
//       userAuthority : userInSession.userAuthority,
//       userEmail :  userInSession.userEmail ?? '-',
//       userOrganization : userInSession.userOrganization ?? '-',
//       userApps : userInSession.userApps ?? [] ,
//     }

    
//   }catch(err){
//     // console.log("Error ===>", err.message)
//     return {
//       userIsActive : null,
//       userEmail : null,
//       userAuthority : null,
//       userApps : [] ,
//     }
//   }finally{
//     client.close()
//   }  
// }


// //================================================
// export function getUserAppActive(userApps,appIdReq) {
//   return userApps.filter( obj => obj.appId == `A${appIdReq}`)
// }


// //================================================
// // Login ในฐานะ Owner หรือไม่
// export async function getUserAuthorityByUserId(userObjectId) {  
//   const client = new MongoClient(dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(dbName)
//     const coll_users = db.collection(dbColl_users)
//     const userInSession = await coll_users.findOne(
//       { 
//         _id : new ObjectId(userObjectId) , 
//         userIsActive : 'active' 
//       },
//       { projection : { 
//           _id : 0, 
//           userIsActive : 1,
//           userAuthority : 1
//         } 
//       }
//     )
//     return userInSession ? userInSession.userAuthority : null
//   }catch(err){
//     return null
//   }finally{
//     client.close()
//   } 
// }

// //================================================
// // Login ในฐานะ Owner หรือไม่
// export async function getUserOrganization(organizationId) {  
//   const client = new MongoClient(dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(dbName)
//     const collection = db.collection(dbColl_organizations)
//     const organization = await collection.findOne(
//       { 
//         organizationId : organizationId , 
//         // organizationIsActive : 'active'
//       },
//       { 
//         projection : { _id : 0 }
//       }
//     )
//     return organization
//   }catch(err){
//     return null
//   }finally{
//     client.close()
//   } 
// }





//=== ค้นหา User
// const _id = new ObjectId(userObjectId)
// const userInSession = await coll_users.aggregate([
//   {
//     $match: { _id: _id }
//   },
//   {
//     $project: { _id:0,userEmail:1,userAuthority:1,userApps:1}
//   },
// ]).toArray();    

// if(userInSession[0].userApps && userInSession[0].userApps.length > 0){
//   userInSession[0].userApps = userInSession[0].userApps.map( obj => {
//     const appDetails = APPS.find( app => app.ID === obj.appId);
//     if (appDetails) {
//       return obj = {
//         appId: obj.appId,
//         appAuthority: obj.appAuthority,
//         appName: appDetails.APPNAME,
//         appPath: appDetails.PATH,
//         appDbName: appDetails.DBNAME
//       }
//     } else {
//       return obj = {
//         appId: obj.appId,
//         appAuthority: obj.appAuthority,
//         appName: null,
//         appPath: null,
//         appDbName: null
//       }
//     }
//   })
// }

// return {
//   userFound : userInSession.length == 1 ? true : false,
//   userEmail : userInSession.length == 1 ? userInSession[0].userEmail : '-',
//   userAuthority : userInSession.length == 1 ? userInSession[0].userAuthority : '-',
//   userApps : userInSession.length == 1 ? userInSession[0].userApps : [] ,
// }

// const userInSession = await coll_users.aggregate([
//   {
//     $match: { _id: _id }
//   },
//   {
//     // $project: { _id: 0, userApps:1, userEmail:1 }
//     $project: { _id: 0}
//   },
//   {
//     $unwind: "$userApps" // Unwind the userApps array to treat each app individually
//   },
//   {
//     $lookup: {
//       from: dbColl_apps, // collection to join with
//       localField: "userApps.appId", // Field from the user document
//       foreignField: "appId", // field from the apps documents to join with
//       as: "appInfo",
//     },
//   },
//   { $unwind: { path: "$appInfo", preserveNullAndEmptyArrays: true } },
//   {
//     $addFields: {
//       "userApps.appPath": "$appInfo.appPath",
//       "userApps.appName": "$appInfo.appName",
//       "userApps.appDbName": "$appInfo.appDbName",
//     }
//   },
//   {
//     $group: {
//       _id: "$_id", // Group back by the user ID
//       userApps: { $push: "$userApps" },
//       userEmail: { $first: "$userEmail" }, // preserves the userEmail, since we will group by _id 
//       userAuthority: { $first: "$userAuthority" },
//     }
//   },
//   {
//     $project: { _id: 0, userApps: 1, userEmail:1 , userAuthority:1 },
//     // $project: { _id: 0 },
//   },
// ]).toArray();
// // console.log("userInSessssion.length ===> " , userInSession.length)
// // console.log("userInSessssion[0] ===> " , userInSession[0])

// return {
//   userFound : userInSession.length == 1 ? true : false,
//   userEmail : userInSession.length == 1 ? userInSession[0].userEmail : '-',
//   userAuthority : userInSession.length == 1 ? userInSession[0].userAuthority : '-',
//   userApps : userInSession.length == 1 ? userInSession[0].userApps : [] ,
// }


// //================================================
// // จับข้อมูล User จากฐานข้อมูลโดยใช้ ObjectId
// export function getSessionData_sign(req) {
//   const userInSession = getSessionData(req)
//   if(userInSession.isAuth){
//     const userId = userInSession.userId

//     // จับลายเซ็นด้วย
//     const userImageSignatureFilename = path.join(
//       global.folderUsers, 
//       `${userId}${global.SIGNATURE_SUFFIX}.png`
//     )
//     if (fs.existsSync(userImageSignatureFilename)) {
//       // อ่านภาพเป็น base64 สำหรับแสดงในอิเล็มเม้นต์img
//       const imageBuffer = fs.readFileSync(userImageSignatureFilename)
//       const base64Image = imageBuffer.toString('base64')
//       // เตรียมพร้อมแสดงใน img
//       const userImageSignature_Src = `data:image/png;base64,${base64Image}`
//       // ฝังรวมกับ userToLoad
//       userInSession.userImageSignature_Src = userImageSignature_Src
//     } 
//     return {
//       isAuth: userInSession.isAuth,
//       user_id: userInSession.user_id,
//       userId: userInSession.userId,
//       username: userInSession.username,
//       userFullname: userInSession.userFullname,
//       userAuthority: userInSession.userAuthority,
//       userImageSignature_Src: userInSession.userImageSignature_Src || null,
//     }
//   }
// }