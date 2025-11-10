/* import XLSX from "xlsx" */
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// const myDocs = await import(`../${mymoduleFolder}/myDocs.js`)
// import multer from 'multer'
// import sharp from 'sharp' ;
// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
// const PATH_LOAD = `${PATH_MAIN}/load`
// const PATH_DELETE = `${PATH_MAIN}/delete`
// const PATH_PRINT = `${PATH_MAIN}/print`
// const PATH_FETCH = `${PATH_MAIN}/fetch`
// const PATH_CHANGES = `${PATH_MAIN}/changes`
// const PATH_ADD_TRIGGER = `${PATH_MAIN}/add-trigger`
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js"
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const PATH_MAIN = '/keys-definition'
const PATH_SAVE = `${PATH_MAIN}/save`

//=======================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)

  //=== คำค้นหา - การแบ่งหน้า
  const rpp = Number(req.query.rpp) || 30
  const page = Number(req.query.page) || 1
  const skipDocs = Number((page - 1) * rpp)  
  
  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_keysDefinition = db.collection(global.dbColl_keysDefinition)

    //== 1) มีคำค้นหา sip
    var totalDocs = await coll_keysDefinition.countDocuments({})
    const pageNum = Math.ceil(totalDocs / rpp)
    const pagePre = Number(page) - 1 < 1 ? "-" : Number(page) - 1
    const pageAct = Number(page)
    const pageNxt = Number(page) + 1 > pageNum ? "-" : Number(page) + 1

    const agg = [
      { $project: {
          _id: 1,
          key: 1,
          keyName: 1,
          keyUnit: 1,
          bgColor: 1,
          fontColor: 1,
        }
      }, // { $sort: { key: -1 } }, // ไม่ต้องเรียง
      { $skip: skipDocs },
      { $limit: rpp },
    ]
    let dataKeysDefinition = await coll_keysDefinition.aggregate(agg).toArray()
    if(dataKeysDefinition.length == 0){
      dataKeysDefinition = [...global.KEYS_DEFINITION] 
    }

    //=== 3) Render
    const html = await myModule.renderView("keysDefinition", res, {
      title: PAGE_KEYS_DEFINITION,
      time: myDateTime.getDate(),
      msg: req.flash('msg'),
      user : myUsers.getSessionData(req),

      //=== สำหรับ คำค้นหา
      //=== สำหรับ pagination
      rpp,
      page,
      pagePre,
      pageAct,
      pageNxt,
      pageLst: pageNum,
      pageRedirect: PATH_MAIN,
      // 
      data: dataKeysDefinition,
      //===
      PATH_MAIN,
      PATH_SAVE,
    })
    return res.send(html)
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})




//=======================================================
// บันทึกได้เฉพาะ O เท่านั้น 
// 
router.post(PATH_SAVE, mainAuth.isO, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const client = new MongoClient(global.dbUrl)
  try {

    const {keysDefinition} = req.body

    await client.connect()
    const db = client.db(global.dbName)
    const coll_keysDefinition = db.collection(global.dbColl_keysDefinition)   
    await coll_keysDefinition.deleteMany({}) // ลบทั้งหมดก่อน
    const rtnUpdate = await coll_keysDefinition.insertMany( keysDefinition )


    //== Return
    if (rtnUpdate.acknowledged && rtnUpdate.insertedCount == keysDefinition.length) {

      //==  อัพเดท global.KEYS_DEFINITION ใหม่ ***** 
      global.KEYS_DEFINITION = keysDefinition

      res.send(JSON.stringify({
        isSave: true,
        class: "green",
        msg: `บันทึกข้อมูลเรียบร้อยแล้ว`,
      }))
    } else {
      res.send(JSON.stringify({
        isSave: false,
        class: "red",
        msg: `ไม่สามารถบันทึกข้อมูลได้`,
      }))
    }
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({
      isSave: false,
      class: "red",
      msg: err.message,
    }))  
  } finally {
    client.close()
  }

})






export default router






// //=============================================
// //
// router.post(PATH_LOAD, mainAuth.isOA, async (req, res) => {  
//   // console.log(`-----------------${req.originalUrl}----------------------`)
//   // console.log("req.body ===> " , req.body)

//   const load_id = req.body.load_id // _id 
//   const sip = req.body.sip
//   const rpp = Number(req.body.rpp) || 30
//   const page = Number(req.body.page) || 1
//   const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${load_id}`

//   const client = new MongoClient(dbUrl)
//   try{
//     const db = client.db(global.dbName);
//     const collection = db.collection(global.dbColl_keysDefinition)
//     const rtn = await collection.findOne(
//       { _id: new ObjectId(load_id) },
//       { projection: { changesHistory : 0 } } // กำหนดฟิลด์ที่ต้องการดึงมาแสดงในฟอร์ม
//     )
//     if( rtn ){
//       req.flash('msg', null)
//     }else{  
//       req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${load_id}"` })
//     }
//     return res.redirect(redirectUrl)
//   }catch(err){
//     console.log(err.message)
//     req.flash('msg', { class:"red", text:`${err.message}` })
//     return res.redirect(redirectUrl)
//   }finally{
//     client.close()
//   }
// })



// //=============================================
// // 
// router.post(PATH_DELETE, mainAuth.isOA, async (req, res) => {  
//   // console.log(`-----------------${req.originalUrl}----------------------`)
//   // console.log("req.body ===> " , req.body)

//   let { _id_toDelete, load_id, sip, Id_toDelete } = req.body
//   const rpp = Number(req.body.rpp) || 30
//   const page = Number(req.body.page) || 1 
//   Id_toDelete = Number(Id_toDelete) // ตัวเลขเท่านั้น

//   //=== ตรวจสอบ load_id ที่ส่งมา
//   // เมื่อมี load_id ส่งมา ต้องไม่ใช่ตัวที่จะลบ - ถ้าเป็นตัวที่จะลบ จะไม่มีการโหลดอีกเมื่อ redirect
//   const load_id_query =  _id_toDelete && _id_toDelete != load_id ? `&load_id=${_id_toDelete}` : ''
//   const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}${load_id_query}`

//   const client = new MongoClient(global.dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(global.dbName)
//     const coll_keysDefinition = db.collection(global.dbColl_keysDefinition)

//     //=== 1.) ตรวจสอบ user ที่จะลบ *** ต้องไม่มีในเอกสารใดๆ ***
//     const collections = [
//       { coll: db.collection(global.dbColl_docs),    // 1
//         name: global.dbColl_docs, 
//         key: 'deviceId' }, // ชื่อคีย์ในเอกสาร ที่ใช้ deviceId
//       // { coll: db.collection(global.dbColl_warehouseOut),   // 2
//       //   name: global.dbColl_warehouseOut, 
//       //   key: 'deviceId' }, 
//       // { coll: db.collection(global.dbColl_sales),       // 3
//       //   name: global.dbColl_sales, 
//       //   key: 'deviceId' }, 
//       // { coll: db.collection(global.dbColl_return),       // 4
//       //   name: global.dbColl_return, 
//       //   key: 'deviceId' }, 
//     ];
//     // ตรวจสอบทุก collection พร้อมกัน ****
//     for (const { coll, name, key } of collections) {
//       //== ค้นหาในแต่ละเอกสาร
//       const query = {};
//       query[key] = Id_toDelete;
//       const docFind = await coll.findOne(query);

//       //== ถ้าพบ Stamp ในคอลเล็กชั่น users ว่าลบไม่ได้ - เอาไปใช้ตอนสร้าง Table
//       // - ถ้าไม่พบในเอกสารใดๆเลย ให้ลบได้
//       if (docFind) {
//         await coll_keysDefinition.updateOne(
//           { deviceId: Id_toDelete }, 
//           { $set: { canDelete: false } }
//         );
//         req.flash('msg', { 
//           class: "red", 
//           text: `ยูสเซอร์ "${Id_toDelete}" มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้` 
//         });
//         return res.redirect(redirectUrl);
//       }
//     }

//     //=== 2.) ลบ User - ถ้าในคอลเล็กชั่นเอกสารทั้งหมดไม่มี
//     const deleteResult = await coll_keysDefinition.deleteOne({ _id: new ObjectId(_id_toDelete) })
//     if (deleteResult.deletedCount === 1) {

//       //== 2.1) ลบ session ทั้งหมดของ user ที่ถูกลบ
//       const coll_sessions = db.collection(global.dbColl_sessions)
//       const deleteSessionResult = await coll_sessions.deleteMany({"session.user_id":_id_toDelete })
//       if(deleteSessionResult.acknowledged && deleteSessionResult.deletedCount > 0){
//         var afterMsg = `{{sep}}( ลบเซสชั่นทั้งหมดจำนวน  "${deleteSessionResult.deletedCount}" เรียบร้อยแล้ว )`
//       }else{  
//         var afterMsg = `{{sep}}( ไม่พบเซสชั่น )`
//       }

//       //== 2.2) Return
//       req.flash('msg', { class:"green", text:`ลบยูสเซอร์ "${Id_toDelete}" เรียบร้อยแล้ว${afterMsg}` })
//     } else {
//       req.flash('msg', { class:"red", text: `ไม่พบ "${Id_toDelete}"{{sep}}( อาจจะถูกลบไปแล้ว )` })
//     }
//     return res.redirect(redirectUrl)
//   } catch (err) {
//     console.log("error ===> ", err);
//     req.flash('msg', { class:"red", text: err.message})  
//     return res.redirect(redirectUrl)
//   } finally {
//     client.close();
//   } 
// })



// //=============================================
// // 
// router.post(PATH_PRINT, mainAuth.isOA, async (req, res) => {  
//   // console.log(`-----------------${req.originalUrl}----------------------`)
//   // console.log("req.body ===> " , req.body)

//   const { _idArr } = req.body
//   const client = new MongoClient(dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_keysDefinition)

//     const devicesFind = await collection.aggregate([
//       { 
//         $match: { 
//           _id: { 
//             $in: _idArr.map(id => new ObjectId(id)) 
//           } 
//         } 
//       },
//       // // Lookup branchName from userBranches
//       // {
//       //   $lookup: {
//       //     from: global.dbColl_userBranches,
//       //     localField: 'branchId',
//       //     foreignField: 'branchId',
//       //     as: 'branchInfo'
//       //   }
//       // },
//       // {
//       //   $addFields: {
//       //     branchName: {
//       //       $ifNull: [ { $arrayElemAt: ['$branchInfo.branchName', 0] }, '' ]
//       //     }
//       //   }
//       // },
//       // { $project: { branchInfo: 0 } }
//     ]).toArray();

//     if(devicesFind.length == 0){
//       return res.send(JSON.stringify({
//         isPrint : false,
//         class : "red",
//         msg: `ไม่มีข้อมูล` , 
//       }))
//     }

//     //=== สร้างฟอร์มจาก HTML
//     const templatePath = path.join(global.folderForms, 'print_devices.ejs');
//     const templateContent = fs.readFileSync(templatePath, 'utf8'); 
//     const htmlPage = ejs.render(templateContent, {
//       time : myDateTime.getDate() ,
//       title : `จำนวน (${devicesFind.length})`,
//       dateTime :  myDateTime.getDateTime() ,
//       devicesFind : devicesFind,
//     })

//     res.send(JSON.stringify({      
//       isPrint : true,
//       class : "green",
//       msg: `พิมพ์ข้อมูล ${devicesFind.length} เรียบร้อยแล้ว` ,
//       htmlPage : htmlPage ,      
//     }))

//   } catch (err) {
//     console.log("error ===> ", err.message);
//     res.send(JSON.stringify({
//       isPrint : false,
//       class : "red",
//       msg: err.message , 
//     }))
//   } finally {
//     client.close();
//   } 
// })


// //=============================================
// // 
// router.post(PATH_CHANGES, mainAuth.isOA, async (req, res) => {

//   //=== 0.1) จับประเภทเอกสาร
//   let { deviceId } = req.body

//   const client = new MongoClient(global.dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_keysDefinition)

//     //=== 1.) ค้นหาเอกสาร (ถ้ามี docId)
//     var deviceFind = await collection.findOne({ deviceId : deviceId })
//     if(!deviceFind){
//       return res.send(JSON.stringify({
//         isPrint: false ,
//         class:"red", 
//         msg:`ไม่พบ "${deviceId}"`
//       }))
//     }

//     //=== 2.) จับเฉพาะค่า changesHistory จาก docFind
//     const changesHistory = deviceFind.changesHistory || []

//     //=== 3.) ตรวจสอบประวัติการเปลี่ยนแปลง
//     if(changesHistory.length < 1){
//       return res.send(JSON.stringify({
//         isPrint: false ,
//         class:"yellow", 
//         msg:`ไม่พบประวัติการเปลี่ยนแปลง`
//       }))
//     }

//     //=== 3.) สร้าง HTML จาก template
//     const templatePath = path.join(folderForms, 'changes_device.ejs')
//     const htmlPage =  await myModule.renderView(templatePath, res, {
//       title: `ประวัติการแก้ไข : [${deviceFind.deviceId}] ${deviceFind.deviceName}`,
//       time: myDateTime.getDateTime(), 
//       changesHistory : changesHistory,
//     });

//     //=== 4.) ส่ง HTML กลับไป
//     res.send(JSON.stringify({
//       isPrint:true,
//       class:"green",
//       htmlPage:htmlPage
//     }))
//   } catch (err) {
//     console.log("error ===> ", err);
//     res.send(JSON.stringify({ isPrint:false, class:"red", msg:err.message}))
//   } finally {
//     client.close();
//   } 
// })


// //=============================================
// //
// router.get(PATH_FETCH, mainAuth.isOA, async (req, res) => {
//   const client = new MongoClient(global.dbUrl)
//   try{
//     const db = client.db(global.dbName)

//     //=== 1.) จับชื่อคอลเล็กชั่นที่ขึ้นต้นด้วย e + ตัวเลข 3 หลัก
//     const regexDeviceColl = /^e\d{3}$/
//     const allColls = await db.listCollections().toArray()
//     const colls_devices_all = allColls
//                           .map(c => c.name)
//                           .filter(name => regexDeviceColl.test(name))     
//                           .sort()

//     //=== 2.) จับข้อมูลจาก coll_keysDefinition
//     const coll_keysDefinition = db.collection(global.dbColl_keysDefinition)
//     const dataDevices = await coll_keysDefinition.find({}).toArray()

//     //=== 3.) ใน colls_devices_all กรอง deviceId ที่ซ้ำกับ dataDevices ออก
//     const deviceIds = dataDevices.map(d => d.deviceId)
//     const colls_devices = colls_devices_all.filter(c => !deviceIds.includes(c))

//     res.send(JSON.stringify({
//       isFetch : true,
//       msg: `โหลดข้อมูลอุปกรณ์ ${colls_devices_all.length} คอลเล็กชัน` ,
//       class : "green",
//       colls_devices, 
//       msg: `ดึงข้อมูลเรียบร้อยแล้ว` , 
//     }))    
//   }catch(err){
//     console.log(err)
//     res.send(JSON.stringify({
//       isFetch : false,
//       msg: err.message,
//       class : "red",
//       data : [],
//       msg: `เกิดข้อผิดพลาดขณะดึงข้อมูล` , 
//     }))
//   }finally{
//     client.close()
//   }
// })


// //=======================================================
// // เมื่อเพิ่มแถวน Trigger ในหน้า Device
// // 
// router.post(PATH_ADD_TRIGGER, mainAuth.isOA, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> " , req.body)

//   const deviceId = req.body.deviceId

//   //=== 0.) ตรวจสอบการมีอยู่ของ deviceId
//   if(!deviceId || deviceId.trim() === ""){
//     return res.send(JSON.stringify({
//       isAddTrigger : false,
//       class:"red",
//       msg: `กรุณาระบุไอดีอุปกรณ์` ,
//     }))    
//   }

//   //=== 0.) ตรวจสอบรูปแบบของ deviceId
//   const deviceIdRegex = new RegExp(global.DEVICE_PATTERN)
//   if (!deviceIdRegex.test(deviceId)) {
//     return res.send(JSON.stringify({
//       isAddTrigger : false,
//       class:"red",
//       msg: `รูปแบบไอดีอุปกรณ์ไม่ถูกต้อง{{sep}}${global.DEVICE_DESCRIPTION}` ,
//     }))    
//   }

//   const client = new MongoClient(global.dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(global.dbName)

//     //=== จับค่า Unique ในฟิลด์ key ในคอลเล็กชั่นชื่อเดียวกับ deviceId
//     const coll_keysDefinition = db.collection(deviceId)
//     const uniqueKeys = await coll_keysDefinition.distinct("key")

//     return res.send(JSON.stringify({
//       isAddTrigger : true,
//       class:"green",
//       uniqueKeys : uniqueKeys ,
//       msg: `ดึงค่าฟิลด์ key ที่ไม่ซ้ำกัน {{sep}}จำนวน ${uniqueKeys.length} ค่าเรียบร้อยแล้ว` ,
//     }))    
//   } catch (err) {
//     res.send(JSON.stringify({
//       isAddTrigger : false,
//       class:"red",
//       msg: err.message ,
//     }))
//   } finally {
//     client.close()
//   }

// })


