/* import XLSX from "xlsx" */
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// const myDocs = await import(`../${mymoduleFolder}/myDocs.js`)
// import multer from 'multer'
// import sharp from 'sharp' ;
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient, ObjectId } from 'mongodb'
import ejs from 'ejs'
import path from 'path'
import fs from 'fs'
import mainAuth from "../middleware/mainAuth.js"
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const myData = await import(`../${mymoduleFolder}/myData.js`)
const PATH_MAIN = '/devices'
const PATH_SAVE = `${PATH_MAIN}/save`
const PATH_LOAD = `${PATH_MAIN}/load`
const PATH_DELETE = `${PATH_MAIN}/delete`
const PATH_PRINT = `${PATH_MAIN}/print`
const PATH_FETCH = `${PATH_MAIN}/fetch`
const PATH_CHANGES = `${PATH_MAIN}/changes`
const PATH_ADD_TRIGGER = `${PATH_MAIN}/add-trigger`
const PREFIX = PATH_MAIN.replace(/\//g,"_") 

//=======================================================
// หน้าแรก user
// 
// http://localhost/manage/users?sip=&rpp=20&page=1&load_id=689eb7d54ea43b1123cb847e
// 
router.get(PATH_MAIN, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)
  // req.query ===>  { sip: '', rpp: '20', page: '1', load_id: '689eb7d54ea43b1123cb847e' }
  // ถ้าไม่มี LoadId
  

  //=== คำค้นหา - การแบ่งหน้า
  let sip = req.query.sip
  sip = sip ? sip.replace(/[.*+?^${}()|[\]\\]/g, '') : '' // เอาตัวอักษรพิเศษออก
  const rpp = Number(req.query.rpp) || 20
  const page = Number(req.query.page) || 1
  const load_id = req.query.load_id || '' // เป็น _id 
  const skipDocs = Number((page - 1) * rpp)  
  const nowLocal = myDateTime.getDateTime(0) // //=== วันปัจจุบัน
  
  const client = new MongoClient(dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_devices = db.collection(global.dbColl_devices)

    //== 1) มีคำค้นหา sip

    //== 1.1) มีคำค้นหา - นับจำนวนเอกสาร
    if (sip) {
      const regex = new RegExp(sip, "i");
      var totalDocs = await coll_devices.countDocuments({
        $or: [
          { deviceId: { $regex: regex } },
          { deviceName: { $regex: regex } },
          { userFirstname: { $regex: regex } },
        ]
      })
    } else { // ไม่มีคำค้นหา
      var totalDocs = await coll_devices.countDocuments({})
    }
    const pageNum = Math.ceil(totalDocs / rpp)
    const pagePre = Number(page) - 1 < 1 ? "-" : Number(page) - 1
    const pageAct = Number(page)
    const pageNxt = Number(page) + 1 > pageNum ? "-" : Number(page) + 1

    const agg = [
      {
        $project: {
          _id: 1,
          deviceId: 1,
          deviceStatus: 1,
          deviceName: 1,
          triggerRows: 1,
          changesHistoryCount: { $size: { $ifNull: ["$changesHistory", []] } },
          isCanDelete: {
            $cond: {
              if: {
                $gt: [
                  {
                    $dateDiff: {
                      startDate: { $toDate: nowLocal },
                      endDate: { $toDate: "$dateTimeCanDelete" },
                      unit: "minute"
                    }
                  },
                  0
                ]
              },
              then: true,
              else: false
            }
          },
        }
      },
      { $sort: { deviceId: -1 } }, 
      { $skip: skipDocs },
      { $limit: rpp },
    ]

    //== 1.2) มีคำค้นหา - ค้นหาเอกสารตาม sip 
    if (sip) {
      const regex = sip ? new RegExp(`${sip}`, "i") : new RegExp(`.*`);
      agg.unshift(
        {
          $match: {
            $or: [              
              { deviceId: { $regex: regex } },
              { deviceName: { $regex: regex } },
            ],
          }
        },
      )
    }


    //== 1.3) ถ้าเป็น A กรอง O ออก รวมถึงกรอก A คนอื่นๆออกเอาตัวเองไว้
    // - A มีสิทธิจัดการผู้ใช้ได้ แต่ U จะไม่เห็น O/A
    const user_current = myUsers.getSessionData(req)
    const userAuthority_current = user_current.userAuthority
    let dataUser = await coll_devices.aggregate(agg).toArray()
    if (['A'].includes(userAuthority_current)) {
      const deviceId_current = user_current.deviceId
      dataUser = dataUser.filter(item => {
        const is_MeS_NotOtherS = item.userAuthority !== 'A' || item.deviceId == deviceId_current
        return item.userAuthority !== 'O' && is_MeS_NotOtherS
      })
    }

    //=== 2.1) ถ้ามี load_id ส่งมา - ให้ค้นหายูสเซอร์ที่จะโหลดลงฟอร์ม
    if (load_id) {
      var deviceToLoad = await coll_devices.findOne(
        { _id: new ObjectId(load_id) },
        { projection: { userPassword: 0 } }
      )
    } else {
      var deviceToLoad = {}
    }

    // //=== 2.2) ตรวจสอบว่า deviceToLoad เป็นอ็อบเจ็กต์ว่าง {}
    // // - ถ้าว่าง ให้เอาค่าจาก req.flash('userFlash') ถ้ามี
    // //   ซึ่งจะมีมาหากในขั้นตอน save เกิด Error
    // if (deviceToLoad && Object.keys(deviceToLoad).length === 0) {
    //   const userFlash = req.flash('userFlash') // flash เป็นอาเรย์
    //   if (userFlash && userFlash.length > 0) {
    //     deviceToLoad = {...userFlash[0]} || null;
    //   }
    // }
    // console.log("deviceToLoad ===> ", deviceToLoad)

    //=== 3) Render
    const html = await myModule.renderView("devices", res, {
      title: PAGE_DEVICES,
      time: myDateTime.getDate(),
      msg: req.flash('msg'),
      user : myUsers.getSessionData(req),
      settings : await myModule.getSettings(),

      //=== สำหรับ คำค้นหา
      load_id, // ส่งมาจากการ load หรือการ save 
      sip,
      //=== สำหรับ pagination
      rpp,
      page,
      pagePre,
      pageAct,
      pageNxt,
      pageLst: pageNum,
      pageRedirect: PATH_MAIN,
      // 
      data: dataUser,
      //===
      PATH_MAIN,
      PATH_PRINT, 
      PATH_SAVE,
      PATH_LOAD,
      PATH_DELETE,
      PATH_FETCH,
      PATH_CHANGES,
      PATH_ADD_TRIGGER,
      PREFIX,

      //=== ใช้คำว่า item แทนเผื่อจะได้ใช้ซ้ำกับอื่นๆได้
      item: deviceToLoad,
      // colls_devices,

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
// ใช้กับทั้ง Create และ Update
router.post(PATH_SAVE, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  //=== 1.) ค่าจาก req.body
  const _id = req.body._id
  delete req.body._id  // ต้องลบออกด้วยไม่เช่นนั้นจะ error เพราะแก้ไข _id ไม่ได้
  const sip = req.body.sip
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1  
  delete req.body.rpp  // ลบออกด้วยไม่เช่นนั้นจะลงฐานข้อมูลด้วย
  delete req.body.sip  // ลบออกด้วยไม่เช่นนั้นจะลงฐานข้อมูลด้วย
  delete req.body.page // ลบออกด้วยไม่เช่นนั้นจะลงฐานข้อมูลด้วย
  // 
  const deviceName = req.body.deviceName?.trim()   // ห้ามซ้ำ - อาจไม่มีถ้าเป็น New
  const deviceId = req.body.deviceId

  //=== 2.) URL สำหรับการ Redirect
  const redirectUrl_error = `${PATH_MAIN}`
  const redirectUrl_update = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${_id}`

  //=== 3.) ตรวจสอบรูปแบบของ deviceName
  const deviceIdRegex = new RegExp(global.DEVICE_PATTERN)
  if (!deviceIdRegex.test(deviceId)) {
    req.flash('msg', {class:"red", text: global.DEVICE_DESCRIPTION})
    return res.redirect(redirectUrl_update)
  }

  //=== 4.) triggerRows เป็นอาเรย์
  let triggerRows_Length = 0
  if(typeof req.body.triggerStatus == 'string'){
    triggerRows_Length = 1
  }else if(typeof req.body.triggerStatus == 'object'){
    triggerRows_Length = req.body.triggerStatus.length
  }
  const triggerRows = []
  if(triggerRows_Length > 1){
    const triggerStatus = req.body.triggerStatus
    const triggerKey = req.body.triggerKey ; 
    const triggerMin = req.body.triggerMin ; 
    const triggerMax = req.body.triggerMax ; 

    //=== 4.1) ตรวจสอบการซ้ำใน req.body.triggerKey
    const keySet = new Set(triggerKey)
    if(keySet.size < triggerKey.length){
      req.flash('msg', { class:"red", text:`มีคีย์ที่เลือกซ้ำกัน` })
      return res.redirect(redirectUrl_update)
    }

    //=== 4.2) สร้างอาเรย์ triggerRows
    for(let i=0; i<=triggerRows_Length-1; i++){
      triggerRows.push({
        triggerStatus:triggerStatus[i] ,
        triggerKey:triggerKey[i]  ,
        triggerMin:triggerMin[i] ? Number(triggerMin[i]) : null ,
        triggerMax:triggerMax[i] ? Number(triggerMax[i]) : null ,
      })
    }
  }else if(triggerRows_Length == 1){
    triggerRows.push({
      triggerStatus:req.body.triggerStatus,
      triggerKey:req.body.triggerKey,
      triggerMin:req.body.triggerMin ? Number(req.body.triggerMin) : null,
      triggerMax:req.body.triggerMax ? Number(req.body.triggerMax) : null,
    })
  }
  delete req.body.triggerStatus
  delete req.body.triggerKey
  delete req.body.triggerMin
  delete req.body.triggerMax
  req.body.triggerRows = [...triggerRows]


  //=== 5) ค่า triggerMin หรือ triggerMax ใน {} แต่ละตัวใน triggerRows ต้องไม่เป็นค่าว่างทั้งหมด
  for(const trg of triggerRows){
    if( trg.triggerMin === null && trg.triggerMax === null ){
      req.flash('msg', { 
        class:"red", 
        text:`กรุณาระบุค่า Min หรือ Max สำหรับคีย์ "${trg.triggerKey}"` 
      })      
      return res.redirect(redirectUrl_update)
    }
  }

  //=== 6) ค่า triggerMin ต้องน้อยกว่า  triggerMax ใน {} แต่ละตัวใน triggerRows
  for(const trg of triggerRows){
    if( trg.triggerMin !== null && trg.triggerMax !== null ){
      if( trg.triggerMin >= trg.triggerMax ){
        req.flash('msg', { 
          class:"red", 
          text:`ค่า Min ต้องน้อยกว่า Max สำหรับคีย์ "${trg.triggerKey}"`
        })
        return res.redirect(redirectUrl_update)
      }
    }
  }

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_devices = db.collection(global.dbColl_devices)
    
    //=== 1.) สร้างใหม่ - ไม่มี _id ส่งมาด้วย
    if (!_id) {

      //== 1.1) ตรวจสอบการซ้ำ - ค้นหา device อื่นๆห้ามซ้ำ
      const deviceFind = await coll_devices.findOne({
        $or: [
          { deviceName: { $regex: new RegExp(`^${deviceName}$`, 'i') } },
          { deviceId: deviceId } ,   // มี deviceId มาด้วย
        ]
      })
      if (deviceFind) {
        req.flash('msg', { class: "red", text: `ชื่ออุปกรณ์{{sep}}มีอยู่ในระบบแล้ว` })
        return res.redirect(redirectUrl_update)
      }

      //== 1.2) Stamp วันเวลาสำหรับแก้ไข เฉพาะ new เท่านั้น (1 วัน)
      req.body.dateTimeCanDelete = myDateTime.getDateTime(1440) // 1 วัน = 1440 นาที
    
      //== 1.3) สร้าง User ใหม่ - บันทึกลงฐานข้อมูล
      const rtnInsert = await coll_devices.insertOne(req.body)
      
      //== 1.4) ผลลัพธ์การบันทึก
      if(rtnInsert.acknowledged && rtnInsert.insertedId){
        const redirectUrl_new = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${rtnInsert.insertedId}`
        req.flash('msg', { class: "green", text: `เพิ่มอุปกรณ์ "${deviceId}" เรียบร้อยแล้ว` })
        return res.redirect(redirectUrl_new)
      }else{
        req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะเพิ่มอุปกรณ์ "${deviceId}"` })
        res.redirect(redirectUrl_error)
      }
    }
  
  //=== 2.) กรณี Update - ******************************      
  else{  

    //== 2.1) ค้นหาการซ้ำกับอปุกรณ์อื่น - แต่ไม่รวมตัวเอง
    // - ค้นหาตาม  deviceName/deviceId
    // - ถ้ามี deviceOtherFind = ซ้ำ
    var deviceOtherFind = await coll_devices.findOne({
      _id: { $ne: new ObjectId(_id) } ,  // ไม่เอาตัวเอง
      $or: [
        { deviceName: { $regex: new RegExp(`^${deviceName}$`, 'i') } },
        { deviceId: deviceId },
      ]
    })
    if (deviceOtherFind) {
      req.flash('msg', { class: "red", text: `ชื่ออุปกรณ์/ไออีอุปกรณ์{{sep}}มีอยู่ในระบบแล้ว` })
      return res.redirect(redirectUrl_update)
    }

    //== 2.2) ข้อมูลก่อนแก้ไข
    const device_before = await coll_devices.findOne({ _id: new ObjectId(_id) })

    //== 2.3) เก็บข้อมูลก่อนแก้ไข - สำหรับตรวจสอบการเปลี่ยนแปลง
    const updateQuery = { $set: req.body }
    const rtnUpdate = await coll_devices.updateOne(
      { _id: new ObjectId(_id) },
      updateQuery,
      { upsert: false }
    )

    //== 2.4) Return on Update
    if (rtnUpdate.acknowledged && rtnUpdate.modifiedCount == 1) {
      
      //= 2.4.1) เก็บ changes
      const user_inSession = myUsers.getSessionData(req)
      let msg = `อัปเดท "${deviceId}" เรียบร้อยแล้ว`
      const changes = myData.getChangeHistory(device_before, req.body);
      if (changes && changes.length > 0) {
        const changeHistoryObj = {
          dateTime : myDateTime.getDateTime() ,
          userId : user_inSession.userId ,
          userFullname : user_inSession.userFullname ,
          changes : changes,
        }
        //= Update History - เพิ่มข้อมูลการอัปเดท
        await coll_devices.updateOne(
          { deviceId: deviceId }, // ไว้ตำแหน่งแรก - แก้ไขที่หลังอยู่บนสุด 
          { $push: { changesHistory: { $each: [changeHistoryObj], $position: 0 } } }
        ) 
        msg += `{{sep}}[ บันทึกการแก้ไข ]`
      }
      
      req.flash('msg', { class: "green", text: msg })
      return res.redirect(redirectUrl_update)      
    } else if (rtnUpdate.acknowledged && (rtnUpdate.modifiedCount < 1 || rtnUpdate.upsertedCount < 1)) {
      req.flash('msg', { class: "yellow", text: `"${deviceId}" ไม่มีอะไรเปลี่ยนแปลง`})
      return res.redirect(redirectUrl_update)
    } else {
      req.flash('msg', { class: "red", text: `${new Error("Not Found")}{{sep}}"${deviceId}"` })
      return res.redirect(redirectUrl_update)
    }
  }
} catch (err) {
  console.log("error ===> ", err);
  res.status(404).sendFile(file404)
} finally {
  client.close()
}

})


//=============================================
//
router.post(PATH_LOAD, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)

  const load_id = req.body.load_id // _id 
  const sip = req.body.sip
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${load_id}`

  const client = new MongoClient(dbUrl)
  try{
    const db = client.db(global.dbName);
    const collection = db.collection(global.dbColl_devices)
    const rtn = await collection.findOne(
      { _id: new ObjectId(load_id) },
      { projection: { changesHistory : 0 } } // กำหนดฟิลด์ที่ต้องการดึงมาแสดงในฟอร์ม
    )
    if( rtn ){
      req.flash('msg', null)
    }else{  
      req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${load_id}"` })
    }
    return res.redirect(redirectUrl)
  }catch(err){
    console.log(err.message)
    req.flash('msg', { class:"red", text:`${err.message}` })
    return res.redirect(redirectUrl)
  }finally{
    client.close()
  }
})



//=============================================
// 
router.post(PATH_DELETE, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)

  let { _id_toDelete, load_id, sip, Id_toDelete } = req.body
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1 
  Id_toDelete = Number(Id_toDelete) // ตัวเลขเท่านั้น

  //=== ตรวจสอบ load_id ที่ส่งมา
  // เมื่อมี load_id ส่งมา ต้องไม่ใช่ตัวที่จะลบ - ถ้าเป็นตัวที่จะลบ จะไม่มีการโหลดอีกเมื่อ redirect
  const load_id_query =  _id_toDelete && _id_toDelete != load_id ? `&load_id=${_id_toDelete}` : ''
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}${load_id_query}`

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_devices = db.collection(global.dbColl_devices)

    //=== 1.) ตรวจสอบ user ที่จะลบ *** ต้องไม่มีในเอกสารใดๆ ***
    const collections = [
      { coll: db.collection(global.dbColl_docs),    // 1
        name: global.dbColl_docs, 
        key: 'deviceId' }, // ชื่อคีย์ในเอกสาร ที่ใช้ deviceId
      // { coll: db.collection(global.dbColl_warehouseOut),   // 2
      //   name: global.dbColl_warehouseOut, 
      //   key: 'deviceId' }, 
      // { coll: db.collection(global.dbColl_sales),       // 3
      //   name: global.dbColl_sales, 
      //   key: 'deviceId' }, 
      // { coll: db.collection(global.dbColl_return),       // 4
      //   name: global.dbColl_return, 
      //   key: 'deviceId' }, 
    ];
    // ตรวจสอบทุก collection พร้อมกัน ****
    for (const { coll, name, key } of collections) {
      //== ค้นหาในแต่ละเอกสาร
      const query = {};
      query[key] = Id_toDelete;
      const docFind = await coll.findOne(query);

      //== ถ้าพบ Stamp ในคอลเล็กชั่น users ว่าลบไม่ได้ - เอาไปใช้ตอนสร้าง Table
      // - ถ้าไม่พบในเอกสารใดๆเลย ให้ลบได้
      if (docFind) {
        await coll_devices.updateOne(
          { deviceId: Id_toDelete }, 
          { $set: { canDelete: false } }
        );
        req.flash('msg', { 
          class: "red", 
          text: `ยูสเซอร์ "${Id_toDelete}" มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้` 
        });
        return res.redirect(redirectUrl);
      }
    }

    //=== 2.) ลบ User - ถ้าในคอลเล็กชั่นเอกสารทั้งหมดไม่มี
    const deleteResult = await coll_devices.deleteOne({ _id: new ObjectId(_id_toDelete) })
    if (deleteResult.deletedCount === 1) {

      //== 2.1) ลบ session ทั้งหมดของ user ที่ถูกลบ
      const coll_sessions = db.collection(global.dbColl_sessions)
      const deleteSessionResult = await coll_sessions.deleteMany({"session.user_id":_id_toDelete })
      if(deleteSessionResult.acknowledged && deleteSessionResult.deletedCount > 0){
        var afterMsg = `{{sep}}( ลบเซสชั่นทั้งหมดจำนวน  "${deleteSessionResult.deletedCount}" เรียบร้อยแล้ว )`
      }else{  
        var afterMsg = `{{sep}}( ไม่พบเซสชั่น )`
      }

      //== 2.2) Return
      req.flash('msg', { class:"green", text:`ลบยูสเซอร์ "${Id_toDelete}" เรียบร้อยแล้ว${afterMsg}` })
    } else {
      req.flash('msg', { class:"red", text: `ไม่พบ "${Id_toDelete}"{{sep}}( อาจจะถูกลบไปแล้ว )` })
    }
    return res.redirect(redirectUrl)
  } catch (err) {
    console.log("error ===> ", err);
    req.flash('msg', { class:"red", text: err.message})  
    return res.redirect(redirectUrl)
  } finally {
    client.close();
  } 
})



//=============================================
// 
router.post(PATH_PRINT, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)

  const { _idArr } = req.body
  const client = new MongoClient(dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_devices)

    const devicesFind = await collection.aggregate([
      { 
        $match: { 
          _id: { 
            $in: _idArr.map(id => new ObjectId(id)) 
          } 
        } 
      },
      // // Lookup branchName from userBranches
      // {
      //   $lookup: {
      //     from: global.dbColl_userBranches,
      //     localField: 'branchId',
      //     foreignField: 'branchId',
      //     as: 'branchInfo'
      //   }
      // },
      // {
      //   $addFields: {
      //     branchName: {
      //       $ifNull: [ { $arrayElemAt: ['$branchInfo.branchName', 0] }, '' ]
      //     }
      //   }
      // },
      // { $project: { branchInfo: 0 } }
    ]).toArray();

    if(devicesFind.length == 0){
      return res.send(JSON.stringify({
        isPrint : false,
        class : "red",
        msg: `ไม่มีข้อมูล` , 
      }))
    }

    //=== สร้างฟอร์มจาก HTML
    const templatePath = path.join(global.folderForms, 'print_devices.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8'); 
    const htmlPage = ejs.render(templateContent, {
      time : myDateTime.getDate() ,
      title : `จำนวน (${devicesFind.length})`,
      dateTime :  myDateTime.getDateTime() ,
      devicesFind : devicesFind,
    })

    res.send(JSON.stringify({      
      isPrint : true,
      class : "green",
      msg: `พิมพ์ข้อมูล ${devicesFind.length} เรียบร้อยแล้ว` ,
      htmlPage : htmlPage ,      
    }))

  } catch (err) {
    console.log("error ===> ", err.message);
    res.send(JSON.stringify({
      isPrint : false,
      class : "red",
      msg: err.message , 
    }))
  } finally {
    client.close();
  } 
})


//=============================================
// 
router.post(PATH_CHANGES, mainAuth.isOA, async (req, res) => {

  //=== 0.1) จับประเภทเอกสาร
  let { deviceId } = req.body

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_devices)

    //=== 1.) ค้นหาเอกสาร (ถ้ามี docId)
    var deviceFind = await collection.findOne({ deviceId : deviceId })
    if(!deviceFind){
      return res.send(JSON.stringify({
        isPrint: false ,
        class:"red", 
        msg:`ไม่พบ "${deviceId}"`
      }))
    }

    //=== 2.) จับเฉพาะค่า changesHistory จาก docFind
    const changesHistory = deviceFind.changesHistory || []

    //=== 3.) ตรวจสอบประวัติการเปลี่ยนแปลง
    if(changesHistory.length < 1){
      return res.send(JSON.stringify({
        isPrint: false ,
        class:"yellow", 
        msg:`ไม่พบประวัติการเปลี่ยนแปลง`
      }))
    }

    //=== 3.) สร้าง HTML จาก template
    const templatePath = path.join(folderForms, 'changes_device.ejs')
    const htmlPage =  await myModule.renderView(templatePath, res, {
      title: `ประวัติการแก้ไข : [${deviceFind.deviceId}] ${deviceFind.deviceName}`,
      time: myDateTime.getDateTime(), 
      changesHistory : changesHistory,
    });

    //=== 4.) ส่ง HTML กลับไป
    res.send(JSON.stringify({
      isPrint:true,
      class:"green",
      htmlPage:htmlPage
    }))
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({ isPrint:false, class:"red", msg:err.message}))
  } finally {
    client.close();
  } 
})


//=============================================
//
router.get(PATH_FETCH, mainAuth.isOA, async (req, res) => {
  const client = new MongoClient(global.dbUrl)
  try{
    const db = client.db(global.dbName)

    //=== 1.) จับชื่อคอลเล็กชั่นที่ขึ้นต้นด้วย e หรือ s + ตัวเลข 3 หลัก
    const regexDeviceColl = new RegExp(`^(e|s)\\d{3}$`, 'i')
    const allColls = await db.listCollections().toArray()
    const colls_devices_all = allColls
                          .map(c => c.name)
                          .filter(name => regexDeviceColl.test(name))     
                          .sort()

    //=== 2.) จับข้อมูลจาก coll_devices
    const coll_devices = db.collection(global.dbColl_devices)
    const dataDevices = await coll_devices.find({}).toArray()

    //=== 3.) ใน colls_devices_all กรอง deviceId ที่ซ้ำกับ dataDevices ออก
    const deviceIds = dataDevices.map(d => d.deviceId)
    const colls_devices = colls_devices_all.filter(c => !deviceIds.includes(c))

    res.send(JSON.stringify({
      isFetch : true,
      msg: `โหลดข้อมูลอุปกรณ์ ${colls_devices_all.length} คอลเล็กชัน` ,
      class : "green",
      colls_devices, 
      msg: `ดึงข้อมูลเรียบร้อยแล้ว` , 
    }))    
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({
      isFetch : false,
      msg: err.message,
      class : "red",
      data : [],
      msg: `เกิดข้อผิดพลาดขณะดึงข้อมูล` , 
    }))
  }finally{
    client.close()
  }
})


//=======================================================
// เมื่อเพิ่มแถวน Trigger ในหน้า Device
// 
router.post(PATH_ADD_TRIGGER, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const deviceId = req.body.deviceId

  //=== 0.) ตรวจสอบการมีอยู่ของ deviceId
  if(!deviceId || deviceId.trim() === ""){
    return res.send(JSON.stringify({
      isAddTrigger : false,
      class:"red",
      msg: `กรุณาระบุไอดีอุปกรณ์` ,
    }))    
  }

  //=== 0.) ตรวจสอบรูปแบบของ deviceId
  const deviceIdRegex = new RegExp(global.DEVICE_PATTERN)
  if (!deviceIdRegex.test(deviceId)) {
    return res.send(JSON.stringify({
      isAddTrigger : false,
      class:"red",
      msg: `รูปแบบไอดีอุปกรณ์ไม่ถูกต้อง{{sep}}${global.DEVICE_DESCRIPTION}` ,
    }))    
  }

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)

    //=== จับค่า Unique ในฟิลด์ key ในคอลเล็กชั่นชื่อเดียวกับ deviceId
    const coll_devices = db.collection(deviceId)
    const uniqueKeys = await coll_devices.distinct("key")

    return res.send(JSON.stringify({
      isAddTrigger : true,
      class:"green",
      uniqueKeys : uniqueKeys ,
      msg: `ดึงค่าฟิลด์ key ที่ไม่ซ้ำกัน {{sep}}จำนวน ${uniqueKeys.length} ค่าเรียบร้อยแล้ว` ,
    }))    
  } catch (err) {
    res.send(JSON.stringify({
      isAddTrigger : false,
      class:"red",
      msg: err.message ,
    }))
  } finally {
    client.close()
  }

})




export default router







// res.render('views400/ebrItems.ejs', {
//   time : myDateTime.getDate() ,
//   title : app.appInfo.PAGE_ITEMS ,

//   //=== สำหรับ คำค้นหา
//   load_id:load_id, // ส่งมาจากการ load หรือการ save 
//   // sip:sip,
//   sip:sip,
//   scid:scid,
//   sis:sis,

//   //=== สำหรับ pagination
//   rpp:rpp ,
//   page:page ,
//   pageAct:pageAct ,
//   pageNum:pageNum ,
//   totalDocs:totalDocs,

//   pathMain : `${app.appInfo.PATH}/devices`,
//   pathLoad : `${app.appInfo.PATH}/devices/load`,
//   pathDelete : `${app.appInfo.PATH}/devices/delete`,
//   pathSave : `${app.appInfo.PATH}/devices/save`,
//   pathViewImage : `${app.appInfo.PATH}/devices/view/`,
//   pathPrint : `${app.appInfo.PATH}/devices/print/`,
//   prefix : `${app.appInfo.PATH}/devices`.replace(/\//g,"_"), 

//   dataDevices:dataDevices, 
//   ITEM_TYPE:ITEM_TYPE,
//   ITEM_STATUS:ITEM_STATUS,
//   ITEM_NAME_UNIQUE:ITEM_NAME_UNIQUE,

//   device:deviceToLoad,

//   //=== จับจาก Settings
//   categoryId : categoryId ,
//   categoryIdJson : JSON.stringify(categoryId),
//   deviceStatus : deviceStatus,
//   deviceStatusJson : JSON.stringify(deviceStatus),
  
//   //===
//   msg : req.flash('msg'),
//   app:app,
//   appJson:JSON.stringify(app),
//   // 
//   userAppAuthority : app.appAuthority, 
//   // 
//   deviceName: req.session.passport?.user.displayName || userInSession.deviceName,
//   userEmail: userInSession.userEmail,
//   userAuthority: userInSession.userAuthority,
//   userApps: userInSession.userApps,
//   userImageUrl: req.session.passport?.user.pictureUrl || null,
//   sessionIsAuth: req.session.sessionIsAuth,
// })