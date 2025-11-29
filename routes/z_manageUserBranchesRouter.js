// import multer from 'multer'
// import XLSX from "xlsx"
// const PATH_VIEW = `${PATH_MAIN}/view`
import express from 'express'
const router = express.Router()
import { MongoClient, ObjectId } from 'mongodb'
import ejs from 'ejs'
import path from 'path'
import fs from 'fs'
import { DateTime } from 'luxon'
import * as myDateTime from "../mymodule/myDateTime.js"
import * as myUsers from "../mymodule/myUsers.js"
import * as myModule from "../mymodule/myModule.js"
import mainAuth from "../middleware/mainAuth.js"
const PATH_MAIN = '/manage/user-branches'
const PATH_SAVE = `${PATH_MAIN}/save`
const PATH_LOAD = `${PATH_MAIN}/load`
const PATH_DELETE = `${PATH_MAIN}/delete`
const PATH_PRINT = `${PATH_MAIN}/print`
const PREFIX = PATH_MAIN.replace(/\//g,"_") 

//================================================================
// หน้า 
// 
router.get(PATH_MAIN, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)/
  // console.log(req.body)

  //=== คำค้นหา - การแบ่งหน้า
  const sip = (req.query.sip?.trim().replace(/[$.*?]/g, ' ')) || '' // แทนที่อักขระพิเศษด้วยช่องว่าง
  const rpp = Number(req.query.rpp) || 20
  const page = Number(req.query.page) || 1
  const load_id = req.query.load_id || ''
  const skipDocs = Number((page-1)*rpp)

  const client = new MongoClient(global.dbUrl)
  try{
    //=== วันปัจจุบัน/projectObj
    const nowLocal = myDateTime.nowLocal().slice(0, 16).replace("T", " ")
    const projectObj = {
      _id: 1,
      branchId: 1 ,     //  "",
      branchStatus: 1 , //  "active",
      branchName: 1 ,   //  "ร้านมานากรูมมิ่ง",
      branchDetail: 1 , //  "ร้านมานากรูมมิ่ง 1 หมู่ 2 หน่องไผ่ เพชรบูรณ์",
      canDelete: 1,
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
      }
    }

    await client.connect()
    const db = client.db(dbName)
    const collection = db.collection(global.dbColl_userBranches)

    //=== มีคำค้นหา - นับจำนวนเอกสาร
    if(sip){ 
      const regex = new RegExp(sip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
      
      // ถ้าเป็น branchId ให้ค้นหาแบบตัวเลข
      let branchIdQuery = {};
      if (!isNaN(Number(sip))) {
        branchIdQuery = { branchId: Number(sip) };
      } else {
        branchIdQuery = { branchId: { $regex: regex } };
      }

      var totalDocs = await collection.countDocuments({
        $or: [
          branchIdQuery,
          { branchName: { $regex: regex } },
        ]
      })
    }else{ // ไม่มี sp
      var totalDocs = await collection.countDocuments({});
    }
    const pageNum = Math.ceil(totalDocs/rpp)
    const pagePre = Number(page)-1 < 1 ? "-" : Number(page)-1 
    const pageAct = Number(page) 
    const pageNxt = Number(page)+1 > pageNum ? "-": Number(page)+1
    
    // 
    const agg = [
      { $project: projectObj },
      { $sort : { branchId : 1 } }, // ต้องอยู่ก่อน $skip และ $limit เรีนวลำดับก่อนข้ามข้อมูล
      { $skip: skipDocs },
      { $limit : rpp },      
    ]

    //=== กรณีมีคำค้นหา - ค้นหาเอกสารตาม sip 
    if(sip){
      const regex = sip ? new RegExp(`${sip}`,"i") : new RegExp(`.*`) ;
      let branchIdQuery = {};
      if (!isNaN(Number(sip))) {
        branchIdQuery = { branchId: Number(sip) };
      } else {
        branchIdQuery = { branchId: { $regex: regex } };
      }

      var totalDocs = await collection.countDocuments({
        $or: [
          branchIdQuery,
          { branchName: { $regex: regex } },
        ]
      })

      agg.unshift(
        { 
          $match: {
            $or: [
              branchIdQuery ,
              { branchName: { $regex: regex } },
            ],
          }
        } ,
      )
    }
    const dataBranches = await collection.aggregate(agg).toArray() 

    //=== กรองตาม branchId ที่ส่งมา เพื่อเอา category ไปแสดงในฟอร์ม ****
    // branchId ที่ส่งมา อาจไม่ต้องกับ pagination ที่กำลังแสดงอยู่
    // ดังนั้นถ้ากรองไม่เจอ ให้ไปหาในฐานข้อมูล
    if (load_id) {
      var loadFilter = dataBranches.filter(obj => obj._id == load_id )
      if (loadFilter.length > 0) {        
        var categoryToLoad = loadFilter[0]
      }else{
        var categoryToLoad = await collection.findOne({ _id: new ObjectId(load_id) })
      }
    }
    // console.log(dataBranches)
    // console.log(categoryToLoad)

    const html = await myModule.renderView("manageUserBranches", res, {
      title: PAGE_MANAGE_USER_BRANCHES, 
      time: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd'),
      msg: req.flash('msg'),
      // ...myUsers.getSessionData(req),
      user : await myUsers.getUserData(req), //=== จับข้อมูลยูสเซอร์จากฐานข้อมูลทุกครั้ง - เพื่อระบุสาขาปัจจุบันเสมอ
      ...await myModule.getSettings(),

      //=== สำหรับ คำค้นหา
      load_id:load_id, // ส่งมาจากการ load หรือการ save 

      sip:sip,
      //=== สำหรับ pagination
      rpp:rpp ,
      page:page ,
      pagePre:pagePre ,
      pageAct:pageAct ,
      pageNxt:pageNxt ,
      pageLst:pageNum ,
      pageRedirect : `${PATH_MAIN}`,

      //===
      PATH_MAIN,
      PATH_SAVE,
      PATH_LOAD,
      PATH_DELETE,
      PATH_PRINT,
      PREFIX,
      //===
      data : dataBranches,
      item : categoryToLoad,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404) 
  }finally{
    client.close()
  }
})



//=======================================================
// ใช้กับทั้ง Create และ Update
// 
router.post(PATH_SAVE, mainAuth.isOA, async (req,res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log(req.body)

  const branchId = req.body.branchId ? Number(req.body.branchId) : null
  const _id = req.body._id // สร่างใหม่จะไม่มี _id
  const sip = req.body.sip
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  const redirectUrl_exist = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${_id}`

  delete req.body._id
  delete req.body.sip
  delete req.body.rpp
  delete req.body.page

  //=== 
  const client = new MongoClient(global.dbUrl);  
  try{
    await client.connect()
    const db = client.db(dbName)
    const collection = db.collection(global.dbColl_userBranches)

    //== 1.) สร้างใหม่
    if(!_id){

      //= 1.1 คำนวณ branchId ใหม่
      const maxId = await collection.find(
        {},
        { projection : { branchId:1 } }
      ).sort({branchId:-1}).limit(1).toArray()
      const fstJobId = 100   // เริ่มต้นที่ 10000
      const newId = maxId.length > 0 
        ? (maxId[0].branchId + 1)
        : fstJobId
      req.body.branchId = newId

      //= 1.2)  Stamp วันเวลาสำหรับแก้ไข เฉพาะ new เท่านั้น (1 วัน)
      let dateTimeCanDelete = myDateTime.newDateTimeLocal()
      dateTimeCanDelete.setDate(dateTimeCanDelete.getDate() + 1)
      dateTimeCanDelete = dateTimeCanDelete.toISOString().slice(0,16).replace("T"," ")
      req.body.dateTimeCanDelete =  dateTimeCanDelete

      //= 1.3) ถ้าไม่ซ้ำ ให้สร้างใหม่
      const categoryFind = await collection.findOne({ branchId: newId })
      if(categoryFind){
        req.flash('msg', { class:"red", text:`เลขที่งาน "${branchId}" ซ้ำ{{sep}} โปรดติดต่อผู้ดูแลระบบ` })
        return res.redirect(PATH_MAIN)
      }
      var rtn = await collection.insertOne(req.body)
    }    
    //== 2.) update - ต้องมี _id ส่งมา
    else{
      // ทำให้ branchId เป็น number เสมอ
      if (req.body.branchId) {
        req.body.branchId = Number(req.body.branchId);
      }
      var rtn = await collection.updateOne(
        { _id: new ObjectId(_id) } ,
        { $set: req.body } ,
        { upsert: false }
      )
    }

    //=== กรณีที่ insert - insertOne
    if( rtn.acknowledged && rtn.insertedId ){
      const redirectUrl_new = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${rtn.insertedId}`
      req.flash('msg', { class:"green", text:`เพิ่ม "${req.body.branchId}" เรียบร้อยแล้ว` })
      return res.redirect(redirectUrl_new)
    }
    //=== กรณี update - updateOne
    else if( rtn.acknowledged && rtn.modifiedCount == 1 ){
      req.flash('msg', { class:"green", text:`อัปเดต "${branchId}" เรียบร้อยแล้ว` })
      return res.redirect(redirectUrl_exist)
    }else if( rtn.acknowledged && rtn.modifiedCount < 1 ){
      req.flash('msg', { class:"yellow", text:`"${branchId}"{{sep}}ไม่มีอะไรเปลี่ยนแปลง` })
      return res.redirect(redirectUrl_exist)
    }else{  
      req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${branchId}"` })    
      return res.redirect(PATH_MAIN)
    }
  }catch(err){
    console.log(err)
    req.flash('msg', { class:"red", text:`${err.message}` })
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }
})


//=============================================
//
router.post(PATH_LOAD, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log(req.query)
  // console.log(req.body)

  //=== ใช้ loadId สำหรับการโหลดข้อมูล branchId 
  const load_id = req.body.load_id // .toString().toUpperCase()
  const sip = req.body.sip
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${load_id}`

  const client = new MongoClient(global.dbUrl)
  try{
    const db = client.db(dbName)
    const collection = db.collection(global.dbColl_userBranches)

    const rtn = await collection.findOne({ _id: new ObjectId(load_id) })
    if(!rtn){  
      req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${load_id}"` })
    }
    return res.redirect(redirectUrl)
  }catch(err){
    req.flash('msg', { class:"red", text:`${err.message}` })
    return res.redirect(redirectUrl)
  }finally{
    client.close()
  }
})


//=============================================
//
// 
router.post(PATH_DELETE, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log(req.body)


  //  เอาไว้ลบ - branchId เอาไว้ redirect กลับไปหาหน้าที่เรียกมา
  const { idToDelete, load_id, sip } = req.body
  const branchId = req.body.branchId ? Number(req.body.branchId) : null
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  // มี load_id ส่งมา และต้องไม่ใช้ตัวที่จะลบ
  const load_id_query =  load_id && load_id != idToDelete  ? `&load_id=${load_id}` : ''
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}${load_id_query}`

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(dbName)
    const coll_customers = db.collection(global.dbColl_userBranches)

    //=== 1.) ตรวจสอบว่ามีไอเท็มที่จะลบหรือไม่
    const itemDoc = await coll_customers.findOne({ _id : new ObjectId(idToDelete) })
    if(!itemDoc){
      req.flash('msg', { class:"red", text:`ไม่พบ "${branchId}"` })
      return  res.redirect(redirectUrl)
    }

    // //=== 2.) ตรวจสอบ branchId ที่จะลบต้องไม่มีใน items ทุกตัว ***
    // const collections = [
    //   { coll: db.collection(global.dbColl_users),        name: global.dbColl_users },
    //   { coll: db.collection(global.dbColl_sales),        name: global.dbColl_sales },
    //   { coll: db.collection(global.dbColl_warehouseIn),  name: global.dbColl_warehouseIn },
    //   { coll: db.collection(global.dbColl_warehouseOut), name: global.dbColl_warehouseOut },
    // ];
    // // ตรวจสอบทุก collection พร้อมกัน ****
    // for (const { coll, name } of collections) {
    //   const docFind = await coll.findOne({ branchId: branchId });
    //   if (docFind) {
    //     //== Stamp ว่าลบไม่ได้ เอาไปใช้ตอนสร้าง Table
    //     await coll_customers.updateOne(
    //       { branchId: branchId }, 
    //       { $set: { canDelete: false } }
    //     );
    //     req.flash('msg', { 
    //       class: "red", 
    //       text: `หมวดหมู่ "${branchId}"{{sep}}มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้`
    //     });
    //     return res.redirect(redirectUrl);
    //   }
    // }

    //=== 2.) ตรวจสอบ user ที่จะลบต้องไม่มีในเอกสารใดๆ
    let msg = ''
    const collections = [
      { coll: db.collection(global.dbColl_users), 
        name: global.dbColl_users, 
        key: 'branchId' }, // ชื่อคีย์ในเอกสาร ที่ใช้ branchId
      { coll: db.collection(global.dbColl_sales), 
        name: global.dbColl_sales, 
        key: 'branchId' }, // ชื่อคีย์ในเอกสาร ที่ใช้ branchId
      { coll: db.collection(global.dbColl_warehouseIn), 
        name: global.dbColl_warehouseIn, 
        key: 'branchId' }, // ชื่อคีย์ในเอกสาร ที่ใช้ branchId
      { coll: db.collection(global.dbColl_warehouseOut), 
        name: global.dbColl_warehouseOut, 
        key: 'branchId' } // ชื่อคีย์ในเอกสาร ที่ใช้ branchId
    ];
    // ตรวจสอบทุก collection พร้อมกัน ****
    for (const { coll, name, key } of collections) {
      //== ค้นหาในแต่ละเอกสาร      
      const query = {};
      query[key] = branchId;
      const docFind = await coll.findOne(query);

      //== ถ้าพบ Stamp ในคอลเล็กชั่น users ว่าลบไม่ได้ - เอาไปใช้ตอนสร้าง Table
      if (docFind) {
        await coll_users.updateOne(
          { userId: branchId }, 
          { $set: { canDelete: false } }
        );
        req.flash('msg', { 
          class: "red", 
          text: `ไอเท็ม "${branchId}" มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้` 
        });
        return res.redirect(redirectUrl);
      }else{
        msg += `ไม่พบ ${branchId} ในตาราง ${name} [คีย์ ${key}]\n`
      }
    }

    //=== 3.) ลบไอเท็ม
    const deleteResult = await coll_customers.deleteOne({ _id : new ObjectId(idToDelete) })
    if (deleteResult.deletedCount === 1) {
      req.flash('msg', { class:"green", text:`ลบ "${branchId}" เรียบร้อยแล้ว{{sep}}${msg.replace(/\n/g,"{{sep}}")}` })
      return res.redirect(redirectUrl)
    } else {
      console.log("Error while deleting")
      req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะลบ "${branchId}"` })
      return res.redirect(redirectUrl)
    }
  } catch (err) {
    console.log("Error ===> ", err);
    req.flash('msg', { class:"red", text: err.message})  
    return res.redirect(redirectUrl)
  } finally {
    client.close();
  } 
})





//=============================================
//
// 
router.post(PATH_PRINT, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)

  const { idsArr } = req.body

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_userBranches)


    const userBranchesFind = await collection.aggregate([
      { $match: { 
          branchId: { $in: idsArr }
        } 
      },
      { $project: {  _id : 0 } },      
      { $addFields: { // เรียงลำดับตามอาเรย์ categoryIdArr ที่ส่งมา
          __order: { $indexOfArray: [idsArr, "$branchId"] } 
        }
      },
      { $sort: { __order: 1 } },
    ]).toArray();
    // console.log("customersFind ===> ", customersFind)

    if(userBranchesFind.length == 0){
      return res.send(JSON.stringify({
        isPrint : false,
        class : "red",
        msg: `ไม่มีข้อมูลที่จะพิมพ์` , 
      }))
    }

    //=== สร้างฟอร์มจาก HTML
    const templatePath = path.join(folderForm, 'formItemsCategory.ejs')
    const templateContent = fs.readFileSync(templatePath, 'utf8'); 
    const htmlPage = ejs.render(templateContent, {      
      web_title : `Print ${userBranchesFind.length} Items`,      
      title : `หมวดหมู่ไอเท็ม`,      
      data : userBranchesFind,
      dateTime : DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm'),
    })

    res.send(JSON.stringify({
      isPrint : true,
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


export default router







// res.render('views400/ebrItems.ejs', {
//   time : myDateTime.formatDate(new Date()) ,
//   title : app.appInfo.PAGE_ITEMS ,

//   //=== สำหรับ คำค้นหา
//   loadId:loadId, // ส่งมาจากการ load หรือการ save 
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

//   pathMain : `${app.appInfo.PATH}/items`,
//   pathLoad : `${app.appInfo.PATH}/items/load`,
//   pathDelete : `${app.appInfo.PATH}/items/delete`,
//   pathSave : `${app.appInfo.PATH}/items/save`,
//   pathViewImage : `${app.appInfo.PATH}/items/view/`,
//   pathPrint : `${app.appInfo.PATH}/items/print/`,
//   prefix : `${app.appInfo.PATH}/items`.replace(/\//g,"_"), 

//   dataItems:dataItems, 
//   ITEM_TYPE:ITEM_TYPE,
//   ITEM_STATUS:ITEM_STATUS,
//   ITEM_NAME_UNIQUE:ITEM_NAME_UNIQUE,

//   item:itemToLoad,

//   //=== จับจาก Settings
//   branchId : branchId ,
//   categoryIdJson : JSON.stringify(branchId),
//   itemStatus : itemStatus,
//   itemStatusJson : JSON.stringify(itemStatus),
  
//   //===
//   msg : req.flash('msg'),
//   app:app,
//   appJson:JSON.stringify(app),
//   // 
//   userAppAuthority : app.appAuthority, 
//   // 
//   username: req.session.passport?.user.displayName || userInSession.username,
//   userEmail: userInSession.userEmail,
//   userAuthority: userInSession.userAuthority,
//   userApps: userInSession.userApps,
//   userImageUrl: req.session.passport?.user.pictureUrl || null,
//   sessionIsAuth: req.session.sessionIsAuth,
// })