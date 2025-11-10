// import mainAuth from "../middleware/mainAuth.js"
import express from 'express'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
const router = express.Router()
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const PATH_ROOT = '/'
const PATH_LOGIN = `${PATH_ROOT}login`
const PATH_ADD_WASAN = `${PATH_ROOT}add-wasan`
const PATH_ADD_BRANCH = `${PATH_ROOT}add-branches`
const PATH_ADD_USERS = `${PATH_ROOT}add-users`
const ADAY_MINUTES = 24*60*60 // 1 วัน ในหน่วยนาที
const START_PASSWORD = process.env.START_PASSWORD || 'qwerty'

//=======================================================
// สำหรับเพิ่มยูสเซอร์ WASAN สำหรับการใช้งานครั้งแรก
// http://localhost/add-wasan?key=wasan123
router.get(PATH_ADD_WASAN, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)

  const { key } = req.query
  if (key !=  process.env.ADD_USER_KEY) {
    req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
    return res.redirect(PATH_LOGIN)
  }
  
  var users_toAdd = [
    {
      userId : 1000,
      userEmail : 'wasankds@gmail.com'  ,
      username : 'wasankds',
      userPrefix: 'นาย' ,
      userFirstname: 'Wasan' ,
      userLastname: 'Khunnadiloksawet' ,
      userAuthority: 'O' ,
      userIsActive: 'active',
      userPassword: await bcrypt.hash(START_PASSWORD, global.BCRYPT_NUMBER),
      branchId: 100,
      dateTimeCanDelete: myDateTime.getDateTime(ADAY_MINUTES),  
    },
    // เพิ่มได้อีกหลายยูสเซอร์
  ]  
  // console.log(userToAdd)

  const client = new MongoClient(global.dbUrl)
  try {
    const db = client.db(global.dbName);
    const coll_users = db.collection(global.dbColl_users)

    //=== กรองเอาเฉพาะยูสเซอร์ที่ยังไม่มีในระบบ
    let users_toAdd_filtered = []
    for(const user of users_toAdd) {
      // ตรวจสอบว่ามีผู้ใช้ WASAN อยู่แล้วหรือไม่
      var userFind = await coll_users.findOne({
        $or: [
          { userId:user.userId } ,
          { username:user.username } ,
          { userEmail:user.userEmail }
        ]
      })
      // ไม่มีผู้ใช้อยู่ - ให้เพิ่มยูสเซอร์ลงในอาเรย์ก่อน
      if( !userFind ) {
        users_toAdd_filtered.push(user)
      }
    }

    //=== ถ้าไม่มีผู้ใช้ที่ต้องการเพิ่มเลย ให้แจ้งเตือนและออก
    if(users_toAdd_filtered.length == 0) {
      req.flash('msg', { class:"red", text:`ยูสเซอร์ทั้งหมด ${users_toAdd.map(u=>u.userId).join(', ')} มีอยู่แล้ว` })
      return res.redirect(PATH_LOGIN)
    }

    //=== เพิ่มผู้ใช้ที่กรองแล้ว ลงในฐานข้อมูล
    const rtn = await coll_users.insertMany(users_toAdd_filtered)
    if (rtn.acknowledged && rtn.insertedCount > 0) {
      req.flash('msg', { class:"green", text:`เพิ่มยูสเซอร์ ${users_toAdd_filtered.map(u=>u.userId).join(', ')} สำเร็จ` })
      res.redirect(PATH_LOGIN)
    } else {
      req.flash('msg', { class:"red", text:`เพิ่มยูสเซอร์ ${users_toAdd_filtered.map(u=>u.userId).join(', ')} ไม่สำเร็จ` })
      res.redirect(PATH_LOGIN)
    }
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})



//=======================================================
// สำหรับเพิ่มยูสเซอร์ WASAN สำหรับการใช้งานครั้งแรก
// 
router.get(PATH_ADD_USERS, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)

  let  { key} = req.query
  if (key !=  process.env.ADD_USER_KEY) {
    req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
    return res.redirect(PATH_LOGIN)
  }

  var usersToAdd = [
    {
      userId : 900, // อาจซ้ำกับที่มีในระบบได้ *****
      userEmail : 'test-s@gmail.com'  ,
      username : 'test-s',
      userPrefix: 'Mr' ,
      userFirstname: 'Test-S' ,
      userLastname: 'SSS' ,
      userAuthority: 'S' ,
      userIsActive: 'active',
      userPassword: await bcrypt.hash('qwerty', global.BCRYPT_NUMBER),
      // branchId: 100,
    }, {
      userId : 901,  // อาจซ้ำกับที่มีในระบบได้ *****
      userEmail : 'test-a@gmail.com'  ,
      username : 'test-a',
      userPrefix: 'Mr' ,
      userFirstname: 'Test-A' ,
      userLastname: 'AAA' ,
      userAuthority: 'A' ,
      userIsActive: 'active',
      userPassword: await bcrypt.hash('qwerty', global.BCRYPT_NUMBER),
      // branchId: 100,
    }, {
      userId : 902,  // อาจซ้ำกับที่มีในระบบได้ *****
      userEmail : 'test-u@gmail.com'  ,
      username : 'test-u',
      userPrefix: 'Mr' ,
      userFirstname: 'Test-U' ,
      userLastname: 'UUU' ,
      userAuthority: 'U' ,
      userIsActive: 'active',
      userPassword: await bcrypt.hash('qwerty', global.BCRYPT_NUMBER),
      // branchId: 100,
    }
  ]

  const client = new MongoClient(dbUrl)
  try {
    const db = client.db(global.dbName);
    const coll_users = db.collection(global.dbColl_users)

    //=== กรองเอาเฉพาะยูสเซอร์ที่ยังไม่มีในระบบ
    let users_toAdd_filtered = []
    for(const user of usersToAdd) {
      // ตรวจสอบว่ามีผู้ใช้ WASAN อยู่แล้วหรือไม่
      var userFind = await coll_users.findOne({
        $or: [
          { userId:user.userId } ,
          { username:user.username } ,
          { userEmail:user.userEmail }
        ]
      })
      // ไม่มีผู้ใช้อยู่ - ให้เพิ่มยูสเซอร์ลงในอาเรย์ก่อน
      if( !userFind ) {
        users_toAdd_filtered.push(user)
      }
    }

    //=== ถ้าไม่มีผู้ใช้ที่ต้องการเพิ่มเลย ให้แจ้งเตือนและออก
    if(users_toAdd_filtered.length == 0) {
      req.flash('msg', { class:"red", text:`ยูสเซอร์ทั้งหมด ${usersToAdd.map(u=>u.userId).join(', ')} มีอยู่แล้ว` })
      return res.redirect(PATH_LOGIN)
    }

    //=== เพิ่มผู้ใช้ที่กรองแล้ว ลงในฐานข้อมูล
    const rtn = await coll_users.insertMany(users_toAdd_filtered)
    if (rtn.acknowledged && rtn.insertedCount > 0) {
      req.flash('msg', { class:"green", text:`เพิ่มยูสเซอร์ ${users_toAdd_filtered.map(u=>u.userId).join(', ')} สำเร็จ` })
      res.redirect(PATH_LOGIN)
    } else {
      req.flash('msg', { class:"red", text:`เพิ่มยูสเซอร์ ${users_toAdd_filtered.map(u=>u.userId).join(', ')} ไม่สำเร็จ` })
      res.redirect(PATH_LOGIN)
    }
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})



// //=======================================================
// // สำหรับเพิ่มยูสเซอร์อื่นๆ ตามจำนวนที่ระบุ
// // โดย userId จะเพิ่มต่อจาก userId สูงสุดที่มีอยู่ในระบบ
// // http://localhost/add-users?key=wasan123&number=3
// // 
// router.get(PATH_ADD_USERS , mainAuth.isOA, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}----------------------`)
//   // console.log("req.query ===> " , req.query)

//   let { key, number } = req.query
//   if (key !=  process.env.ADD_USER_KEY) {
//     req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
//     return res.redirect(PATH_LOGIN)
//   }
//   if( !number || isNaN(parseInt(number)) ) {
//     req.flash('msg', { class:"red", text:'strId ไม่ถูกต้อง' })
//     return res.redirect(PATH_LOGIN)
//   }

//   number = parseInt(number)
//   if( number < 1 || number > 5 ) {
//     req.flash('msg', { class:"red", text:'number ต้องอยู่ระหว่าง 1-5' })
//     return res.redirect(PATH_LOGIN)
//   }
  

//   //===== 
//   const client = new MongoClient(global.dbUrl)
//   try {
//     const db = client.db(global.dbName);
//     const coll_users = db.collection(global.dbColl_users)

//     //=== จับ userId สุดท้ายใน collection users
//     var lastUser = await coll_users.find({}).sort({userId:-1}).limit(1).toArray()
//     var startId = 0
//     if( lastUser.length > 0 ) { 
//       startId = lastUser[0].userId + 1
//     }else{
//       return req.flash('msg', { class:"red", text:'ยังไม่มีผู้ใช้ในระบบเลย ต้องเพิ่มผู้ใช้หลักก่อน' })
//     }

    
//     // วนลูปสร้าง user ตั้งแต่ userId เริ่ม strId ถึง endId
//     var users_toAdd = []  
//     const endId = startId + number - 1
//     for (let i = startId; i <= endId; i++) {
//       users_toAdd.push({
//         userId: i ,
//         userEmail: `user-${i}@gmail.com`,
//         username: `user-${i}`,
//         userPrefix: '',
//         userFirstname: `user-${i}`,
//         userLastname: ``,
//         userAuthority: 'U',
//         userIsActive: 'active',
//         userPassword: await bcrypt.hash(START_PASSWORD, global.BCRYPT_NUMBER),
//         branchId: 100,
//         dateTimeCanDelete: myDateTime.getDateTime(ADAY_MINUTES),
//       })
//     }

//     //=== กรองเอาเฉพาะยูสเซอร์ที่ยังไม่มีในระบบ
//     let users_toAdd_filtered = []
//     for(const user of users_toAdd) {
//       // ตรวจสอบว่ามีผู้ใช้ WASAN อยู่แล้วหรือไม่
//       var userFind = await coll_users.findOne({
//         $or: [
//           { userId:user.userId } ,
//           { username:user.username } ,
//           { userEmail:user.userEmail }
//         ]
//       })
//       // ไม่มีผู้ใช้อยู่ - ให้เพิ่มยูสเซอร์ลงในอาเรย์ก่อน
//       if( !userFind ) {
//         users_toAdd_filtered.push(user)
//       }
//     }

//     //=== ถ้าไม่มีผู้ใช้ที่ต้องการเพิ่มเลย ให้แจ้งเตือนและออก
//     if(users_toAdd_filtered.length == 0) {
//       req.flash('msg', { class:"red", text:`ยูสเซอร์ทั้งหมด ${users_toAdd.map(u=>u.userId).join(', ')} มีอยู่แล้ว` })
//       return res.redirect(PATH_LOGIN)
//     }

//     //=== เพิ่มผู้ใช้ที่กรองแล้ว ลงในฐานข้อมูล
//     const rtn = await coll_users.insertMany(users_toAdd_filtered)
//     if (rtn.acknowledged && rtn.insertedCount > 0) {
//       req.flash('msg', { class:"green", text:`เพิ่มยูสเซอร์ ${users_toAdd_filtered.map(u=>u.userId).join(', ')} สำเร็จ` })
//       res.redirect(PATH_LOGIN)
//     } else {
//       req.flash('msg', { class:"red", text:`เพิ่มยูสเซอร์ ${users_toAdd_filtered.map(u=>u.userId).join(', ')} ไม่สำเร็จ` })
//       res.redirect(PATH_LOGIN)
//     }
//   } catch (err) {
//     console.log(err.message)
//     res.status(404).sendFile(file404)
//   } finally {
//     client.close()
//   }
// })

//=======================================================
// สำหรับเพิ่มสาขา ลงในฐานข้อมูล 2 สาขา ตายตัว
// http://localhost/add-branches?key=wasan123
router.get(PATH_ADD_BRANCH, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)

  let  { key } = req.query
  if (key !=  process.env.ADD_USER_KEY) {
    req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
    return res.redirect(PATH_LOGIN)
  }

  const aday = 24*60*60*1000 // 1 วัน
  var branches_toAdd = [
    {
      branchId: 100,
      branchStatus: "active",
      branchName: "มานากรูมมิ่ง",
      branchDetail: "มานากรูมมิ่ง อ.หนองไผ่ จ.เพชรบูรณ์",
      dateTimeCanDelete: myDateTime.getDateTime(aday),  
    }, 
    {
      branchId: 101,
      branchStatus: "active",
      branchName: "สาขา 2",
      branchDetail: "รายละเอียด สาขา 2",
      dateTimeCanDelete: myDateTime.getDateTime(aday),  
    }
  ]  
  // console.log(userToAdd)

  const client = new MongoClient(dbUrl)
  try {
    const db = client.db(dbName);
    const collection = db.collection(dbColl_userBranches)

    //=== กรองเอาเฉพาะยูสเซอร์ที่ยังไม่มีในระบบ
    let branches_toAdd_filtered = []
    for(const branch of branches_toAdd) {
      // ตรวจสอบว่ามีผู้ใช้ WASAN อยู่แล้วหรือไม่
      var branchFind = await collection.findOne({
        $or: [
          { branchId:branch.branchId } ,
        ]
      })
      // ไม่มีผู้ใช้อยู่ - ให้เพิ่มยูสเซอร์ลงในอาเรย์ก่อน
      if( !branchFind ) {
        branches_toAdd_filtered.push(branch)
      }
    }

    //=== ถ้าไม่มีผู้ใช้ที่ต้องการเพิ่มเลย ให้แจ้งเตือนและออก
    if(branches_toAdd_filtered.length == 0) {
      req.flash('msg', { class:"red", text:`สาขา  ${branches_toAdd.map(u=>u.branchId).join(', ')} มีอยู่แล้ว` })
      return res.redirect(PATH_LOGIN)
    }

    //=== เพิ่มผู้ใช้ที่กรองแล้ว ลงในฐานข้อมูล
    const rtn = await collection.insertMany(branches_toAdd_filtered)
    if (rtn.acknowledged && rtn.insertedCount > 0) {
      req.flash('msg', { class:"green", text:`เพิ่มสาขา ${branches_toAdd_filtered.map(u=>u.branchId).join(', ')} สำเร็จ` })
      res.redirect(PATH_LOGIN)
    } else {
      req.flash('msg', { class:"red", text:`เพิ่มสาขา ${branches_toAdd_filtered.map(u=>u.branchId).join(', ')} ไม่สำเร็จ` })
      res.redirect(PATH_LOGIN)
    }
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})






export default router

