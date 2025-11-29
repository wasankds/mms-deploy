// import multer from 'multer'
// import XLSX from "xlsx"
// const PATH_VIEW = `${PATH_MAIN}/view`
import express from 'express'
const router = express.Router()
import { MongoClient, ObjectId } from 'mongodb'
import ejs from 'ejs'
import path from 'path'
import fs from 'fs'
import * as myDateTime from "../mymodule/myDateTime.js"
import * as myUsers from "../mymodule/myUsers.js"
import * as myModule from "../mymodule/myModule.js"
import mainAuth from "../middleware/mainAuth.js"
import { DateTime } from 'luxon' // import * as luxon from 'luxon'
const PATH_MAIN = '/items-category'
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
    const nowLocal = myDateTime.getDateTime(0) // '2024-06-10 14:30'
    const projectObj = {
      _id: 1,
      categoryId: 1,
      categoryName: 1,
      categoryStatus: 1,
      categoryColor: 1,
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
    const collection = db.collection(global.dbColl_itemsCategory)

    if(sip){ // มีคำค้นหา
      const regex = new RegExp(sip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
      var totalDocs = await collection.countDocuments({
          $or: [
            { categoryId:   { $regex: regex } },
            { categoryName: { $regex: regex } },
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
      { $sort : { categoryId : 1 } }, // ต้องอยู่ก่อน $skip และ $limit เรีนวลำดับก่อนข้ามข้อมูล
      { $skip: skipDocs },
      { $limit : rpp },      
    ]

    //==== กรณีมีคำค้นหา
    if(sip){
      const regex = sip ? new RegExp(`${sip}`,"i") : new RegExp(`.*`) ;
      agg.unshift(
        { 
          $match: {
            $or: [
              { categoryId:   { $regex: regex } },
              { categoryName: { $regex: regex } },
            ],
          }
        } ,
      )
    }
    const dataItemsCategory = await collection.aggregate(agg).toArray() 
    // console.log("dataItemsCategory ===> ", dataItemsCategory)

    //=== กรองตาม categoryId ที่ส่งมา เพื่อเอา category ไปแสดงในฟอร์ม ****
    // categoryId ที่ส่งมา อาจไม่ต้องกับ pagination ที่กำลังแสดงอยู่
    // ดังนั้นถ้ากรองไม่เจอ ให้ไปหาในฐานข้อมูล
    if (load_id) {
      var loadFilter = dataItemsCategory.filter(obj => obj._id == load_id )
      if (loadFilter.length > 0) {        
        var categoryToLoad = loadFilter[0]
      }else{
        var categoryToLoad = await collection.findOne({ _id: new ObjectId(load_id) })
      }
    }
    // console.log(dataItemsCategory)
    // console.log(categoryToLoad)

    const html = await myModule.renderView("itemsCategory", res, {
      title: PAGE_ITEMS_CATEGORY ,
      time: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd'),
      msg: req.flash('msg'),
      user : await myUsers.getUserData(req) , //=== จับข้อมูลยูสเซอร์จากฐานข้อมูลทุกครั้ง
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
      data : dataItemsCategory,
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

  const categoryId = req.body.categoryId ? Number(req.body.categoryId) : null
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
    const collection = db.collection(global.dbColl_itemsCategory)

    //== 1.) สร้างใหม่
    if(!_id){

      //= 1.1 คำนวณ categoryId ใหม่
      const maxCategoryId = await collection.find(
        {},
        { projection : { categoryId:1 } }
      ).sort({categoryId:-1}).limit(1).toArray()
      const fstJobId = 100   // เริ่มต้นที่ 100
      const newCategoryId = maxCategoryId.length > 0 
        ? (maxCategoryId[0].categoryId + 1)
        : fstJobId
      req.body.categoryId = newCategoryId

      //= 1.2)  Stamp วันเวลาสำหรับแก้ไขลบ
      req.body.dateTimeCanDelete = myDateTime.getDateTime(1440) // 1 วัน = 1440 นาที

      //= 1.3) ถ้าไม่ซ้ำ ให้สร้างใหม่
      const categoryFind = await collection.findOne({ categoryId: newCategoryId })
      if(categoryFind){
        req.flash('msg', { class:"red", text:`เลขที่งาน "${categoryId}" ซ้ำ{{sep}} โปรดติดต่อผู้ดูแลระบบ` })
        return res.redirect(PATH_MAIN)
      }
      var rtn = await collection.insertOne(req.body)
    }    
    //== 2.) update - ต้องมี _id ส่งมา
    else{
      // ทำให้ categoryId เป็น number เสมอ
      if (req.body.categoryId) {
        req.body.categoryId = Number(req.body.categoryId);
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
      req.flash('msg', { class:"green", text:`เพิ่ม "${req.body.categoryId}" เรียบร้อยแล้ว` })
      return res.redirect(redirectUrl_new)
    }
    //=== กรณี update - updateOne
    else if( rtn.acknowledged && rtn.modifiedCount == 1 ){
      req.flash('msg', { class:"green", text:`อัปเดต "${categoryId}" เรียบร้อยแล้ว` })
      return res.redirect(redirectUrl_exist)
    }else if( rtn.acknowledged && rtn.modifiedCount < 1 ){
      req.flash('msg', { class:"yellow", text:`"${categoryId}"{{sep}}ไม่มีอะไรเปลี่ยนแปลง` })
      return res.redirect(redirectUrl_exist)
    }else{  
      req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${categoryId}"` })    
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

  //=== ใช้ loadId สำหรับการโหลดข้อมูล categoryId 
  const load_id = req.body.load_id // .toString().toUpperCase()
  const sip = req.body.sip
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${load_id}`

  const client = new MongoClient(global.dbUrl)
  try{
    const db = client.db(dbName)
    const collection = db.collection(global.dbColl_itemsCategory)

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
  // {
  //   idToDelete: '689d7e849ee6711b36180191',
  //   categoryId: '1006',
  //   load_id: '689d7be3c0a1716ffe497f6f',
  //   rpp: '20',
  //   sip: '',
  //   page: '1'
  // }

  // categoryIdToDelete เอาไว้ลบ - categoryId เอาไว้ redirect กลับไปหาหน้าที่เรียกมา
  const { idToDelete, load_id, sip } = req.body
  const categoryId = req.body.categoryId ? Number(req.body.categoryId) : null
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  // มี load_id ส่งมา และต้องไม่ใช้ตัวที่จะลบ
  const load_id_query =  load_id && load_id != idToDelete  ? `&load_id=${load_id}` : ''
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}${load_id_query}`

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(dbName)
    const coll_customers = db.collection(global.dbColl_itemsCategory)

    //=== 1.) ตรวจสอบว่ามีไอเท็มที่จะลบหรือไม่
    const itemDoc = await coll_customers.findOne({ _id : new ObjectId(idToDelete) })
    if(!itemDoc){
      req.flash('msg', { class:"red", text:`ไม่พบ "${categoryId}"` })
      return  res.redirect(redirectUrl)
    }

    //=== 2.) ตรวจสอบ categoryId ที่จะลบต้องไม่มีใน items ทุกตัว ***
    const collections = [
      { coll: db.collection(global.dbColl_items), name: global.dbColl_items },
    ];
    // ตรวจสอบทุก collection พร้อมกัน ****
    for (const { coll, name } of collections) {
      const docFind = await coll.findOne({ categoryId: categoryId });
      if (docFind) {
        //== Stamp ว่าลบไม่ได้ เอาไปใช้ตอนสร้าง Table
        await coll_customers.updateOne(
          { categoryId: categoryId }, 
          { $set: { canDelete: false } }
        );
        req.flash('msg', { 
          class: "red", 
          text: `หมวดหมู่ "${categoryId}"{{sep}}มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้`
        });
        return res.redirect(redirectUrl);
      }
    }

    //=== 3.) ลบไอเท็ม
    const deleteResult = await coll_customers.deleteOne({ _id : new ObjectId(idToDelete) })
    if (deleteResult.deletedCount === 1) {
      req.flash('msg', { class:"green", text:`ลบ "${categoryId}" เรียบร้อยแล้ว`})  
      return res.redirect(redirectUrl)
    } else {
      console.log("Error while deleting")
      req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะลบ "${categoryId}"` })
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
    const collection = db.collection(global.dbColl_itemsCategory)


    const itemsCategoryFind = await collection.aggregate([
      { $match: { 
          categoryId: { $in: idsArr }
        } 
      },
      { $project: {  _id : 0 } },      
      { $addFields: { // เรียงลำดับตามอาเรย์ categoryIdArr ที่ส่งมา
          __order: { $indexOfArray: [idsArr, "$categoryId"] } 
        }
      },
      { $sort: { __order: 1 } },
    ]).toArray();
    // console.log("customersFind ===> ", customersFind)

    if(itemsCategoryFind.length == 0){
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
      web_title : `Print ${itemsCategoryFind.length} Items`,      
      title : `หมวดหมู่ไอเท็ม`,      
      data : itemsCategoryFind,
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






