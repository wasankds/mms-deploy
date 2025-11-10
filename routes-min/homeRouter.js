

// import { MongoClient } from 'mongodb'
// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
// import multer from 'multer'
// import XLSX from "xlsx"
import express from 'express'
const router = express.Router()
import mainAuth from "../middleware/mainAuth.js" 
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const PATH_MAIN = '/'
const PATH_TERM = '/term-and-conditions'
const PREFIX = PATH_MAIN.replace(/\//g,"_") 


//================================================================
// หน้าแรก 
// 
router.get(PATH_MAIN, mainAuth.isAuth, async (req, res) => {
  // console.log(`--------${req.originalUrl}------------`)
  // console.log(req.query)


  // ถ้าไม่มี user ใน session ให้ลบ session ทิ้ง
  // let user = await myUsers.getUserData(req)
  // if(!user) {
  //   req.session.destroy( err => {
  //     if(err) console.log("Error destroy session ===> " , err.message)
  //     return res.redirect('/login')
  //   })
  // }

  try {
    const html = await myModule.renderView('home', res, {
      title:PAGE_HOME ,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),

      user: myUsers.getSessionData(req),
      settings : await myModule.getSettings(),

      PREFIX: PREFIX,
    })
    res.send(html)
  } catch (error) {
    console.log("Error ===> " , error.message)
    res.status(404).sendFile(file404)
    // }finally{client.close()
  }
})


//=======================================
// ข้อกำหนดและเงื่อนไข
// 
router.get(PATH_TERM, mainAuth.isAuth,  async (req, res) => {
  // console.log(`--------${req.originalUrl}------------`)
  // console.log(req.query)
  try {
    const html = await myModule.renderView('termAndConditions', res, {
      title:PAGE_TERM ,
      time: myDateTime.getDate(),
      msg: req.flash('msg'),
      user: myUsers.getSessionData(req),
      settings : await myModule.getSettings(),
    })
    res.send(html)
  } catch (error) {
    res.status(404).sendFile(file404)
  }
})









export default router



/***************************************************************/
/***************************************************************/
/***************************************************************/
/***************************************************************/
/***************************** Report ****************************/
/***************************************************************/
/***************************************************************/
/***************************************************************/
/***************************************************************/


// //================================================================
// // app - 400
// // 
// router.get("/report", [mainAuth.isAuth , auth400.isAU, mainAuth.logger], async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`) 
//   // console.log(req.body)

//   const originalUrl = req.originalUrl
//   const appIdReq = originalUrl.split('/')[3].split('?')[0]
//   const sessionUser_id = req.session.sessionUser_id
//   const userInSession = await myUsers.getUserById(sessionUser_id)
//   const app = myUsers.getUserAppActive(userInSession.userApps, appIdReq)[0]

//   const client = new MongoClient(dbUrl);
//   try{
//     await client.connect()

//     //=== จับข้อมูล Users เฉพาะในองค์กรของตนเอง
//     const dbMain = client.db(dbName)
//     const coll_users = dbMain.collection(dbColl_users)
//     const dataUsers = await coll_users.aggregate([
//       { 
//         $match: { 
//           // userIsActive: 'active',
//           userOrganization: userInSession.userOrganization 
//         }
//       },
//       {
//         $project: {
//           _id: 0 , 
//           // username: 1 , 
//           userIsActive: 1 ,
//           userId: 1 , 
//           userAuthority: 1 , 
//           // userPhone: { $ifNull: ["$userPhone", "-"] }, 
//           userFullname: { $concat: ["$userPrefix"," ","$userFirstname"," ","$userLastname"] },
//         }
//       }
//     ]).toArray()
//     // console.log("dataUsers ===> " , dataUsers)


//     const dbApp = client.db(app.appInfo.DBNAME)
//     //=== คำนวณเดือนใน docs ทั้งหมด -  Month
//     const datesDocs = await dbApp.collection(dbColl_docs).distinct("dateBorrow", {})
//     const monthDocsUnique = [...new Set(datesDocs.map(date => date.slice(0, 7)))]
//     const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
//     const monthDocs = monthDocsUnique.map( month => {
//       const [year, monthNum] = month.split("-");
//       return { month, monthName: `${monthNames[parseInt(monthNum)-1]} ${year}` }
//     })
//     monthDocs.sort( (a,b) => {
//       return a.month > b.month ? -1 : 1
//     })
    
//     //=== จับข้อมูล Jobs ทั้งหมด
//     const dataJobs = await dbApp.collection(dbColl_jobs).aggregate([
//       { $match: { jobIsActive: 'active' } },
//       { $project: { _id: 0 } },
//       { $sort: { jobId: 1 } }
//     ]).toArray()
//     // - แก้ไขสำหรับทำ JSON.stringify 
//     dataJobs.forEach( obj => {
//       for( let key in obj){
//         if (key == 'jobDesc') {
//           obj[key] = obj[key].replace(/"/g, `\\"`).replace(/\r\n|\r|\n/g,"\\n")
//         }
//       }
//     })

//     //=== จับข้อมูล Items ทั้งหมด
//     const dataItems = await dbApp.collection(dbColl_items).aggregate([
//       // { $match: {} },
//       { $project: { _id: 0 } },
//       { $sort: { itemId: 1 } }
//     ]).toArray()
//     // - แก้ไขสำหรับทำ JSON.stringify 
//     dataItems.forEach( obj => {
//       for( let key in obj){
//         if (key == 'itemName' || key == 'itemDesc') {
//           obj[key] = obj[key].replace(/"/g, `\\"`).replace(/\r\n|\r|\n/g,"\\n")
//         }
//       }
//     })

//     // //=== จับข้อมูล Items ทั้งหมด
//     // const dataDocIds = await dbApp.collection(dbColl_docs).distinct("docId", {})
//     const dataDocIds = await dbApp.collection(dbColl_docs).find(
//       {},
//       { projection : { _id: 0, docId: 1, dateBorrow: 1 } }
//     ).toArray()
    

//     res.render('views400/ebrReport.ejs', {
//       time : myDateTime.formatDate(new Date()) ,
//       title : app.appInfo.PAGE_REPORT ,
//       app:app,
//       // 
//       // dataUsers : dataUsers,
//       dataUsersJson : JSON.stringify(dataUsers),
//       // dataItems : dataItems,
//       dataItemsJson : JSON.stringify(dataItems) ,
//       // dataJobs : dataJobs,
//       dataJobsJson : JSON.stringify(dataJobs) ,
//       // dataDocIds : dataDocIds,
//       dataDocIdsJson : JSON.stringify(dataDocIds) ,
//       // 
//       monthDocs:monthDocs, 
//       pathFetchReportData : `${app.appInfo.PATH}/report/fetch`, 
//       pathFetchReportCalendar : `${app.appInfo.PATH}/report/calendar`, 
//       // 
//       // 
//       msg : req.flash('msg'),
//       userAppAuthority : app.appAuthority, 
//       userInSession:userInSession,
//       username: req.session.passport?.user.displayName || userInSession.username,
//       userEmail: userInSession.userEmail,
//       userAuthority: userInSession.userAuthority,
//       userApps: userInSession.userApps,
//       userImageUrl: req.session.passport?.user.pictureUrl || null,
//       sessionIsAuth: req.session.sessionIsAuth,
//     })
//   }catch(err){
//     console.log(err.message)
//     res.status(404).sendFile(folderPublic+'/static/404.html')
//   }finally{
//     client.close()
//   }
// })


// //================================================================
// // app - 400
// // 
// router.post("/report/fetch", [mainAuth.isAuth , auth400.isAU, mainAuth.logger], async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`) 
//   // console.log("req.body ===> " , req.body)
//   const originalUrl = req.originalUrl
//   const appIdReq = originalUrl.split('/')[3].split('?')[0]
//   const sessionUser_id = req.session.sessionUser_id
//   const userInSession = await myUsers.getUserById(sessionUser_id)
//   const app = myUsers.getUserAppActive(userInSession.userApps, appIdReq)[0]

//   const { selectMonth, reportType, itemId,searchItem, jobId,searchJob, userId,searchUser } = req.body
//   const docId = req.body.docId ? Number(req.body.docId) : null

//   const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
//   const [year, month] = selectMonth.split("-");
//   const formattedMonth = `${monthNames[parseInt(month) - 1]} ${year}`
//   let title = `${formattedMonth}`
//   if(userId){ title += ` / (${userId}) ${searchUser}` }
//   if(itemId){ title += ` / (${itemId}) ${searchItem}` }
//   if(jobId){ title += ` / (${jobId}) ${searchJob}` }
//   if(docId){ title += ` / ${docId}` }

//   const client = new MongoClient(dbUrl);
//   try{
//     await client.connect()
//     const dbApp = client.db(app.appInfo.DBNAME)
//     const coll_docs = dbApp.collection(dbColl_docs)
//     // const coll_items = dbApp.collection(dbColl_items)
    
//     //=== docsReport - รายงานเอกสาร
//     if(reportType == 'docsReport'){
//       const aggDocsReport = [
//         { $match: { dateBorrow: { $regex: `^${selectMonth}` }}  },
//         {
//           $project: {
//             _id : 0, 
//             docId : 1 ,
//             docStatusNum : 1 ,
//             borrowerId : 1 ,
//             borrowerName : 1 ,
//             jobId : 1 ,
//             jobDesc : 1 ,
//             giverId : 1 ,
//             giverName : 1 ,
//             placeToUse : 1 ,
//             dateBorrow_Show : 1 ,
//             dateBorrow : 1 ,
//             checkerId : 1 ,
//             checkerName : 1 ,
//             dateReturn : 1 ,
//             dateReturn_Show : 1 ,
//             receiverId : 1 ,
//             receiverName : 1 ,
//             returnerId : 1 ,
//             returnerName : 1 ,
//             // "itemsBorrow": 0
//             docStatus: {
//               $switch: {
//                 branches: [
//                   { case: { $eq: ["$docStatusNum", 1] }, then: 'เบิก' },
//                   { case: { $eq: ["$docStatusNum", 2] }, then: 'รอคืน' },
//                   { case: { $eq: ["$docStatusNum", 3] }, then: 'ปิด' },
//                   { case: { $eq: ["$docStatusNum", 10] }, then: 'ยกเลิก' },
//                 ],
//                 default: 'Unknown'
//               }
//             },
//             docStatusColor: {
//               $switch: {
//                 branches: [
//                   { case: { $eq: ["$docStatusNum", 1] }, then: 'fc-liskyblue' },
//                   { case: { $eq: ["$docStatusNum", 2] }, then: 'fc-ligreen' },
//                   { case: { $eq: ["$docStatusNum", 3] }, then: 'fc-orange' },
//                   { case: { $eq: ["$docStatusNum", 10] }, then: 'fc-red' },
//                 ],
//                 default: 'Unknown'
//               }
//             }
//           }
//         }
//       ]
//       //=== กรอง
//       if(userId){ aggDocsReport.unshift({ $match: { borrowerId: userId } }) }
//       if(itemId){ aggDocsReport.unshift({ $match: { "itemsBorrow.itemId": itemId } }) }
//       if(jobId){ aggDocsReport.unshift({ $match: { jobId: jobId } }) }
//       if(docId){ aggDocsReport.unshift({ $match: { docId: docId } }) }
//       const dataDocs = await coll_docs.aggregate(aggDocsReport).toArray()

//       //=== สร้างฟอร์มจาก HTML
//       const templatePath = path.join(folderViews, 'views400/forms/reportDoc.ejs')
//       const templateContent = fs.readFileSync(templatePath, 'utf8'); 
//       var htmlDiv = ejs.render( templateContent, {
//         title : title,
//         // selectMonth : selectMonth,
//         // formattedMonth : formattedMonth,
//         data : dataDocs,
//       })
//     }

//     //=== itemsReport - รายงานไอเท็ม
//     else if(reportType == 'itemsReport'){

//       //=== 1.) จับ docs ทั้งหมด  
//       // - เพื่อให้แน่นอนว่ามี Items ที่ถูกยืมแน่นอน
//       // - แต่ใน docs อาจมี Items ที่ไม่ตรงกับ itemId ที่ส่งมา
//       const aggItemsInDocs = [
//         { $match: { dateBorrow: { $regex: `^${selectMonth}` } } },
//         { $unwind: "$itemsBorrow" },
//         { $group: { _id: "$itemsBorrow.itemId" } },
//         { $project: { _id: 0, itemId: "$_id" }  },
//         { $sort: { itemId: 1 } }
//       ]
//       //====
//       if(userId){ aggItemsInDocs.unshift({ $match: { borrowerId: userId } }) }
//       if(itemId){ aggItemsInDocs.unshift({ $match: { "itemsBorrow.itemId": itemId } }) }
//       if(jobId){ aggItemsInDocs.unshift({ $match: { jobId: jobId } }) }
//       if(docId){ aggItemsInDocs.unshift({ $match: { docId: docId } }) }
//       // console.log("aggItemsInDocs ===> " , aggItemsInDocs)
      
//       //=== 2.) จับ Item Unique ของไอเท็มในเอกสาร
//       // - ถ้ามี itemId ส่งมาให้จับเฉพาะ itemId นั้นเพียงตัวเดียว
//       const dataDocsByItems =  await coll_docs.aggregate(aggItemsInDocs).toArray()
//       if(itemId){ 
//         var uniqueItemIds = [itemId] 
//       }else{
//         var uniqueItemIds = dataDocsByItems.map( obj => obj.itemId)
//       }

//       //=== 3.) จับเฉพาะเอกสารที่มีไอเท็มตามรายการใน uniqueItemIds
//       // - *** สร้างโครงสร้างที่มีข้อมูล doc และ itemId แต่ยังไม่เอา itemsBorrow มาใส่
//       // - รวมถึงกรองตาม userId, itemId, jobId, docId
//       // - แต่ในเอกสารอาจมีไอเท็มที่ไม่ตรงกับ itemId ที่ส่งมา ฉนั้นต้องไปกรองต่อ
//       const aggDocsByItems = [
//         { $match: { dateBorrow: { $regex: `^${selectMonth}` } }  },
//         { $match: { "itemsBorrow.itemId": { $in: uniqueItemIds } } },
//         { $unwind: "$itemsBorrow" },
//         { $group: {
//             _id: "$itemsBorrow.itemId",
//             docs: {
//               $addToSet: {
//                 docId: "$docId",
//                 dateBorrow: "$dateBorrow",
//                 dateBorrow_Show: "$dateBorrow_Show",
//                 placeToUse: "$placeToUse",
//                 jobId: "$jobId",
//                 jobDesc: "$jobDesc",
//                 borrowerId: "$borrowerId",
//                 borrowerName: "$borrowerName",

//                 dateReturn: "$dateReturn",
//                 dateReturn_Show: "$dateReturn_Show",
//                 returnerId: "$returnerId",
//                 returnerName: "$returnerName",
//                 checkerId: "$checkerId",
//                 checkerName: "$checkerName",

//                 // itemsBorrow: 1 , // ไม่ได้ใช้
//                 docStatusNum: "$docStatusNum",
//                 docStatus: {
//                   $switch: {
//                     branches: [
//                       { case: { $eq: ["$docStatusNum", 1] }, then: 'เบิก' },
//                       { case: { $eq: ["$docStatusNum", 2] }, then: 'รอคืน' },
//                       { case: { $eq: ["$docStatusNum", 3] }, then: 'จบ' },
//                       { case: { $eq: ["$docStatusNum", 10] }, then: 'ยกเลิก' },
//                     ],
//                     default: 'Unknown'
//                   }
//                 },
//                 docStatusColor: {
//                   $switch: {
//                     branches: [
//                       { case: { $eq: ["$docStatusNum", 1] }, then: 'fc-liskyblue' },
//                       { case: { $eq: ["$docStatusNum", 2] }, then: 'fc-ligreen' },
//                       { case: { $eq: ["$docStatusNum", 3] }, then: 'fc-orange' },
//                       { case: { $eq: ["$docStatusNum", 10] }, then: 'fc-red' },
//                     ],
//                     default: 'Unknown'
//                   }
//                 }
//               }
//             }
//           }
//         },
//         { $project: { _id:0, itemId:"$_id", docs: 1 } },
//       ]
//       if(userId){ aggDocsByItems.unshift({ $match: { borrowerId: userId } }) }
//       if(itemId){ aggDocsByItems.unshift({ $match: { "itemsBorrow.itemId": itemId } }) }
//       if(jobId){ aggDocsByItems.unshift({ $match: { jobId: jobId } }) }
//       if(docId){ aggDocsByItems.unshift( { $match: { docId: docId } }) }
//       //=== 
//       let dataItemsInDoc = await coll_docs.aggregate(aggDocsByItems).toArray()
//       if(itemId){ // กรอง itemBorrow ใน docs ตาม itemId ที่ส่งมา
//         dataItemsInDoc = dataItemsInDoc.filter( obj => itemId == obj.itemId ) 
//       }

//       //=== 4.) จับ docs เฉพาะเอกสารที่มีไอเท็มตามรายการใน uniqueItemIds
//       let dataDocs = await coll_docs.aggregate([
//         { $match: { dateBorrow: { $regex: `^${selectMonth}` } } },
//         { $match: { "itemsBorrow.itemId": { $in: uniqueItemIds } } },
//         { $project: { _id:0, docId:1 , itemsBorrow:1 } },
//       ]).toArray()
//       if(itemId){ 
//         dataDocs = dataDocs.map( obj => {
//           const itemsBorrow = obj.itemsBorrow
//           const filter = itemsBorrow.filter( item => item.itemId == itemId )
//           obj.itemsBorrow = filter
//           return obj
//         }) 
//       }

//       //=== 5.) วนลูปจากจับ itemsBorrow ใน dataDocs มาใส่
//       dataItemsInDoc.map( itemObj => {
//         const docs = itemObj.docs
//         if( docs && docs.length > 0){
//           docs.forEach( doc => {
//             const docId = doc.docId
//             // กรอง itemsBorrow ใน dataDocs ตาม itemId ที่ส่งมา
//             const docFilter = dataDocs.filter( obj => obj.docId == docId)
//             if(docFilter.length > 0){
//               doc.itemsBorrow = docFilter[0].itemsBorrow.filter( obj => {
//                 return obj.itemId == itemObj.itemId
//               })
//             }else{
//               doc.itemsBorrow = []
//             }
//           })
//         }
//         return itemObj
//       })
//       dataItemsInDoc.sort( (a,b) => {
//         return a.itemId > b.itemId ? 1 : -1
//       })

//       //=== สร้างฟอร์มจาก HTML
//       const templatePath = path.join(folderViews, 'views400/forms/reportItems.ejs')
//       const templateContent = fs.readFileSync(templatePath, 'utf8'); 
//       var htmlDiv = ejs.render(templateContent, {
//         title : title,
//         data: dataItemsInDoc ,
//       })
//     }

//     return res.send(JSON.stringify({
//       isLoad:true, 
//       class:"green", 
//       htmlDiv:htmlDiv
//     }))
//   }catch(err){
//     console.log(err)
//     res.send(JSON.stringify({ 
//       isLoad:false, 
//       class:"red", 
//       msg:err.message
//     }))
//   }finally{
//     client.close()
//   }
// })

// //================================================================
// // app - 400
// // 
// router.post("/report/calendar", [mainAuth.isAuth , auth400.isAU, mainAuth.logger], async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`) 
//   // console.log("req.body ===> " , req.body)

//   const originalUrl = req.originalUrl
//   const appIdReq = originalUrl.split('/')[3].split('?')[0]
//   const sessionUser_id = req.session.sessionUser_id
//   const userInSession = await myUsers.getUserById(sessionUser_id)
//   const app = myUsers.getUserAppActive(userInSession.userApps, appIdReq)[0]

//   const { selectMonth, itemId,searchItem, jobId,searchJob, userId,searchUser } = req.body
//   const docId = req.body.docId ? Number(req.body.docId) : null

//   // const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
//   const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
//   const [year, month] = selectMonth.split("-");
//   const formattedMonth = `${monthNames[parseInt(month) - 1]} ${year}`;
//   let title = `${formattedMonth}`
//   if(userId){ title += ` / (${userId}) ${searchUser}` }
//   if(itemId){ title += ` / (${itemId}) ${searchItem}` }
//   if(jobId){ title += ` / (${jobId}) ${searchJob}` }
//   if(docId){ title += ` / ${docId}` }

//   const client = new MongoClient(dbUrl);
//   try{
//     await client.connect()
//     const dbApp = client.db(app.appInfo.DBNAME)
//     const coll_docs = dbApp.collection(dbColl_docs)
//     // const coll_items = dbApp.collection(dbColl_items)
    
//     //=== docsReport - รายงานเอกสาร
//     const aggCalendarReport = [
//       {
//         $match: { 
//           dateBorrow: { $regex: `^${selectMonth}` }
//         } 
//       },
//       {
//         $project: {
//           _id : 0, 
//           docId : 1 ,          //  1,
//           docStatusNum : 1 ,   //  2,
//           borrowerId : 1 ,     //  "100004",
//           borrowerName : 1 ,   //  "MR Info Wasankds.com",
//           jobId : 1 ,          //  "2661",
//           jobDesc : 1 ,        //  "Hardfacing front impact",
//           giverId : 1 ,        //  "100001",
//           giverName : 1 ,      //  "นาย วสันต์ คุณดิลกเศวต",
//           placeToUse : 1 ,     //  "onSite",
//           dateBorrow : 1 ,       //  "2025-02-15",
//           dateBorrow_Show : 1 ,  //  "15 January 2025",
//           checkerId : 1 ,      //  "100001",
//           checkerName : 1 ,    //  "นาย วสันต์ คุณดิลกเศวต",
//           dateReturn : 1 ,     //  "2025-02-16",
//           dateReturn_Show : 1 , //  "16 January 2025",
//           receiverId : 1 ,     //  "100001",
//           receiverName : 1 ,   //  "นาย วสันต์ คุณดิลกเศวต",
//           returnerId : 1 ,     //  "100004",
//           returnerName : 1 ,   //  "MR Info Wasankds.com"
//           itemsBorrow: 1 ,
//           docStatus: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$docStatusNum", 1] }, then: 'เบิก' },
//                 { case: { $eq: ["$docStatusNum", 2] }, then: 'รอคืน' },
//                 { case: { $eq: ["$docStatusNum", 3] }, then: 'ปิด' },
//                 { case: { $eq: ["$docStatusNum", 10] }, then: 'ยกเลิก' },
//               ],
//               default: 'Unknown'
//             }
//           },
//           docStatusColor: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$docStatusNum", 1] }, then: 'fc-liskyblue' },
//                 { case: { $eq: ["$docStatusNum", 2] }, then: 'fc-ligreen' },
//                 { case: { $eq: ["$docStatusNum", 3] }, then: 'fc-orange' },
//                 { case: { $eq: ["$docStatusNum", 10] }, then: 'fc-red' },
//               ],
//               default: 'Unknown'
//             }
//           }
//         }
//       }
//     ]

//     //=== กรอง 
//     if(userId){ aggCalendarReport.unshift({ $match: { borrowerId: userId } }) }
//     if(itemId){ aggCalendarReport.unshift({ $match: { "itemsBorrow.itemId": itemId } }) }
//     if(jobId){ aggCalendarReport.unshift( { $match: { jobId: jobId } }) }
//     if(docId){ aggCalendarReport.unshift({ $match: { docId: docId } }) }
//     const dataDocs = await coll_docs.aggregate(aggCalendarReport).toArray()
//     title += ` ( จำนวนเอกสาร = ${dataDocs.length} )`

//     //=== ส่งไปสร้างปฏิทินด้วย JavaScript
//     res.send(JSON.stringify({
//       isLoad:true,
//       class:"green", 
//       title:title,
//       dataDocs:dataDocs,
//       selectMonth:selectMonth,
//       msg:"โหลดข้อมูลเรียบร้อยแล้ว",
//     }))
//   }catch(err){
//     console.log(err.message)
//     res.send(JSON.stringify({ 
//       isLoad:false, 
//       class:"red", 
//       title:title,
//       selectMonth:selectMonth,
//       msg:err.message,
//     }))
//   }finally{
//     client.close()
//   }
// })



















// //=======================================================
// // update
// // 
// router.post("/update", [mainAuth.isAuth , auth400.isAU, mainAuth.logger], async (req,res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   const originalUrl = req.originalUrl
//   const appIdReq = originalUrl.split('/')[3]
//   //=== จับข้อมูล User
//   const sessionUser_id = req.session.sessionUser_id
//   const userInSession = await myUsers.getUserById(sessionUser_id)
//   // console.log("userInSession ===> " , userInSessaion)
//   const app = myUsers.getUserAppActive(userInSession.userApps, appIdReq)[0]
//   const appDbName = app.appInfo.DBNAME
//   const client = new MongoClient(dbUrl);  
//   try{
//     const db = client.db(appDbName)
//     const collection = db.collection(dbColl_items)

//     const itemId = req.body.itemId
//     delete req.body.itemId
//     const updateRtn = await collection.updateOne(
//       { itemId : { $regex: new RegExp(`^${itemId}$`, 'i') } } ,
//       { $set : req.body }    )

//     //=== อัพเดทได้
//     if(updateRtn.matchedCount == 1 && updateRtn.modifiedCount <= 0){ 
//       return res.send(JSON.stringify({
//         isUpdate : false,
//         itemId : itemId ,
//         item : req.body,
//         class : "yellow",
//         msg:`ข้อมูล "${itemId}" ไม่มีอะไรเปลี่ยนแปลง` 
//       }))
//     }else if(updateRtn.matchedCount == 1 && updateRtn.modifiedCount > 0){    
//       return res.send(JSON.stringify({
//         isUpdate : true,
//         itemId : itemId ,
//         item : req.body,
//         class : "green",
//         msg:`อัปเดท "${itemId}" เรียบร้อยแล้ว` 
//       }))
//     }else{
//       return res.send(JSON.stringify({
//         isUpdate : false,
//         itemId : itemId ,
//         class : "red",
//         msg:`Error while updating item "${itemId}"` 
//       }))
//     }
//   }catch(err){
//     console.log(err.message)
//     res.status(404).sendFile(file404)
//   }finally{
//     client.close()
//   }
// })


// //=======================================================
// // delete
// // 
// router.post("/delete", [mainAuth.isAuth , auth400.isAU, mainAuth.logger], async (req,res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   const originalUrl = req.originalUrl
//   const appIdReq = originalUrl.split('/')[3]
//   //=== จับข้อมูล User
//   const sessionUser_id = req.session.sessionUser_id
//   const userInSession = await myUsers.getUserById(sessionUser_id)
//   // console.log("userInSession ===> " , userInSessaion)
//   const app = myUsers.getUserAppActive(userInSession.userApps, appIdReq)[0]
//   const appDbName = app.appInfo.DBNAME

//   const client = new MongoClient(dbUrl)
//   try{
//     const db = client.db(appDbName)
//     const collection = db.collection(dbColl_items)

//     const itemId = req.body.itemId
//     const deleteRtn = await collection.deleteOne(
//       { itemId : { $regex: new RegExp(`^${itemId}$`, 'i') } } ,
//     )

//     //=== ลบได้
//     if(deleteRtn.deletedCount == 1){
//       return res.send(JSON.stringify({
//         isDelete : true,
//         itemId : itemId ,
//         class : "green",
//         msg:`ลบ "${itemId}" เรียบร้อยแล้ว` 
//       }))
//     }else{
//       return res.send(JSON.stringify({
//         isDelete : false,
//         itemId : itemId ,
//         class : "red",
//         msg:`Error while updating item "${itemId}"` 
//       }))
//     }
//   }catch(err){
//     console.log(err.message)
//     res.status(404).sendFile(file404)
//   }finally{
//     client.close()
//   }
// })