// import * as myUsers from "../mymodule/myUsers.js" 
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myModule from "../mymodule/myModule.js" 
import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js"
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const myData = await import(`../${mymoduleFolder}/myData.js`)
const PATH_MAIN = '/alerts'
const PREFIX = PATH_MAIN.replace(/\//g,"_") 

//=======================================================
//
// 
router.get(PATH_MAIN, mainAuth.isOA, async (req, res) => {

  //=== คำค้นหา - การแบ่งหน้า
  const rpp = Number(req.query.rpp) || 30
  const page = Number(req.query.page) || 1
  const skipDocs = Number((page - 1) * rpp)

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_alerts = db.collection(global.dbColl_alerts)
    const totalDocs = await coll_alerts.countDocuments({})
    const pageNum = Math.ceil(totalDocs / rpp)
    const pagePre = Number(page) - 1 < 1 ? "-" : Number(page) - 1
    const pageAct = Number(page)
    const pageNxt = Number(page) + 1 > pageNum ? "-" : Number(page) + 1

    //=== จับ alerts ทั้งหมด 
    const dataAlerts = await coll_alerts.aggregate([      
      { $project: { _id: 0, } },
      { $sort: { timestamp: -1 } },
      { $skip: skipDocs },
      { $limit: rpp },
    ]).toArray()

    //=== คำนวณและเพิ่มฟิลด์ timestampAgo
    const now = myDateTime.now()
    dataAlerts.forEach( obj => {
      const { diffDhm } = myDateTime.calc_DiffDateTime( obj.timestamp, now )
      obj.timestampAgo = `${diffDhm}ก่อน`
    })
    // console.log(dataAlerts)


    const html = await myModule.renderView("alerts", res, {
      title: PAGE_ALERTS,
      time: myDateTime.getDate(),
      msg: req.flash('msg'),
      user : myUsers.getSessionData(req), 

      //=== สำหรับ pagination
      rpp ,
      page,
      pagePre,
      pageAct,
      pageNxt,
      pageLst: pageNum,
      pageRedirect: PATH_MAIN,
      // 
      data: dataAlerts,
      // count_alertByUserId, 
      //===
      PATH_MAIN,
      PREFIX,
      // PATH_DELETE,
      // PATH_CLEAR,
    })
    return res.send(html)
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})


//================================================================
// 
// 
router.post(global.PATH_GET_ALERTS_USER, mainAuth.isAuth , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  // const client = new MongoClient(global.dbUrl)
  try{
    // await client.connect()
    // const db = client.db(global.dbName)    

    const user = myUsers.getSessionData(req)
    const dataAlerts = await myData.getAlertsByUserId(user.userId)

    res.send(JSON.stringify({
      isGet: true,
      class: "green",
      dataAlerts,
      msg: `โหลดข้อมูลแจ้งเตือนเรียบร้อยแล้ว` ,
    }))
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({      
      isGet : false,
      class : "red",
      msg: err.message ,
    }))
  }finally{
    // client.close()
  }

})

//================================================================
// 
// 
router.post(global.PATH_GET_ALERTS_USER_DEVICE, mainAuth.isAuth , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)

  // const client = new MongoClient(global.dbUrl)
  try{
    // await client.connect()
    // const db = client.db(global.dbName)    

    const { deviceId } = req.body 
    if(!deviceId){
      return res.send(JSON.stringify({      
        isGet : false,
        class : "red",
        msg: 'ไม่มีไอดีของคอนโทรเลอร์ส่งมา' ,
      }))
    }
    const user = myUsers.getSessionData(req)
    const dataAlerts = await myData.getAlertsByUserIdDeviceId(user.userId, deviceId)

    res.send(JSON.stringify({
      isGet: true,
      class: "green",
      dataAlerts,
      msg: `โหลดข้อมูลแจ้งเตือนเรียบร้อยแล้ว` ,
    }))
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({      
      isGet : false,
      class : "red",
      msg: err.message ,
    }))
  }finally{
    // client.close()
  }

})






export default router








// //=============================================
// // 
// router.post(PATH_DELETE, mainAuth.isOA, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}----------------------`)
//   // console.log("req.body ===> " , req.body)
//   // req.body ===>   { _id: 'SzAtCn6UY7JdWhlLPDeANamZe2WWkdC2', rpp: '30', page: '1' }

//   const { _id } = req.body
//   const rpp = Number(req.body.rpp) || 30
//   const page = Number(req.body.page) || 1
//   const redirectUrl = `${PATH_MAIN}?rpp=${rpp}&page=${page}`

//   const client = new MongoClient(dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(dbName)
//     const collection = db.collection(dbColl_alerts)

//     //=== Session เก็บข้อมูล _id ไม่เป็น ObjectId สามารถลบได้เลย โดยไม่ต้องแปลง new ObjectId
//     // const deleteResult = await collection.deleteOne({ _id: new ObjectId(_id) })
//     const deleteResult = await collection.deleteOne({ _id: _id })
//     if (deleteResult.deletedCount === 1) {
//       req.flash('msg', { class: "green", text: `ลบ "${_id}" เรียบร้อยแล้ว` })
//       return res.redirect(redirectUrl)
//     } else {
//       req.flash('msg', { class: "red", text: `ไม่พบ "${_id}"{{sep}}อาจจะถูกลบไปแล้ว` })
//       return res.redirect(redirectUrl)
//     }
//   } catch (err) {
//     req.flash('msg', { class: "red", text: err.message })
//     return res.redirect(redirectUrl)
//   } finally {
//     client.close();
//   }
// })



//=============================================
// ล้างโดยใช้ AJAX
//
// router.get( PATH_CLEAR, mainAuth.isOA, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}----------------------`)
//   // console.log("req.query ===> " , req.query)
//   const rpp = Number(req.query.rpp) || 30
//   const page = Number(req.query.page) || 1

//   const client = new MongoClient(dbUrl);
//   try{
//     const db = client.db(dbName);
//     const collection = db.collection(dbColl_alerts)
    
//     //=== ลบเซสชั่นที่ไม่มีคีย์ isAuth - ไม่ได้ login 
//     const rtn = await collection.deleteMany({
//       'session.isAuth': { $exists: false }
//       // session: { $exists: true }, // ต้องมี session
//       // 'session.isAuth': { $ne: true } // isAuth ใน session ต้องไม่เท่ากับ true (หรือไม่มี)
//     });
//     const redirectUrl = `${PATH_MAIN}?rpp=${rpp}&page=${page}`
//     if(rtn.acknowledged == true){
//       req.flash('msg', {
//         class: "green", 
//         text: `ล้างเซสชั่นว่างจำนวน ${rtn.deletedCount} เซสชั่น{{sep}}เรียบร้อยแล้ว` 
//       })
//       res.redirect(redirectUrl)
//     }else{
//       req.flash('msg', { class: "red", text: `Error while deleting session` })
//       res.redirect(redirectUrl)
//     }
//   }catch(err){
//     req.flash('msg', { class: "red", text: err.message })
//     res.redirect(redirectUrl)
//   }finally{
//     client.close()
//   }

// })

