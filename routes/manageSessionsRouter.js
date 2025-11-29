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
const PATH_MAIN = '/manage/sessions'
const PATH_DELETE = `${PATH_MAIN}/delete`
const PATH_CLEAR = `${PATH_MAIN}/clear`

//=======================================================
//
// 
router.get(PATH_MAIN, mainAuth.isOA, async (req, res) => {

  //=== คำค้นหา - การแบ่งหน้า
  const rpp = Number(req.query.rpp) || 20
  const page = Number(req.query.page) || 1
  const skipDocs = Number((page - 1) * rpp)

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_sessions = db.collection(global.dbColl_sessions)
    const totalDocs = await coll_sessions.countDocuments({})
    const pageNum = Math.ceil(totalDocs / rpp)
    const pagePre = Number(page) - 1 < 1 ? "-" : Number(page) - 1
    const pageAct = Number(page)
    const pageNxt = Number(page) + 1 > pageNum ? "-" : Number(page) + 1

    // const dataSessions = await coll_sessions.aggregate(agg).toArray()    
    const dataSessions = await coll_sessions.aggregate([      
      {
        $project: {
          _id: 1,
          expires: 1,
          expiresFormat: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$expires",
              timezone: "Asia/Bangkok" // Adjust timezone if needed
            }
          },
          isAuth: "$session.isAuth",
          username: "$session.username",
          userId: "$session.userId",
          userAuthority: "$session.userAuthority",
          userFirstname: "$session.userFirstname",
          userLastname: "$session.userLastname",
          branchId: "$session.branchId",
          branchName: "$session.branchName",

          durationDaysHours: {
            $concat: [
              {
                $toString: {
                  $floor: {
                    $divide: [
                      { $subtract: ["$expires", new Date()] },
                      1000 * 60 * 60 * 24 // Convert milliseconds to days
                    ]
                  }
                }
              },
              "D+", // Days
              {
                $toString: {
                  $round: [
                    {
                      $mod: [
                        {
                          $divide: [
                            { $subtract: ["$expires", new Date()] },
                            1000 * 60 * 60 // Convert milliseconds to hours
                          ]
                        },
                        24 // Get the remainder hours
                      ]
                    },
                    2 // Round to 2 decimal places
                  ]
                }
              },
              "H" // Hours
            ]
          }, 

          // durationHours: { // ห้ามลบ
          //   $round: [
          //     {
          //       $divide: [
          //         { $subtract: ["$expires", new Date()] },
          //         1000 * 60 * 60 // Convert milliseconds to hours
          //       ]
          //     },
          //     2 // Round to 2 decimal places
          //   ]
          // }
        }
      },
      { $sort: { username: -1 } },
      { $skip: skipDocs },
      { $limit: rpp },
    ]).toArray()
    // console.log("dataSessions ===> ", dataSessions)

    const html = await myModule.renderView("manageSessions", res, {
      title: PAGE_MANAGE_SESSIONS,
      time: myDateTime.getDate(),
      msg: req.flash('msg'),
      user : myUsers.getSessionData(req), 
      settings : await myModule.getSettings(),

      //=== สำหรับ pagination
      rpp ,
      page,
      pagePre,
      pageAct,
      pageNxt,
      pageLst: pageNum,
      pageRedirect: PATH_MAIN,
      // 
      data: dataSessions,
      //===
      PATH_MAIN,
      PATH_DELETE,
      PATH_CLEAR,
    })
    return res.send(html)
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})





//=============================================
// 
router.post(PATH_DELETE, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)
  // req.body ===>   { _id: 'SzAtCn6UY7JdWhlLPDeANamZe2WWkdC2', rpp: '20', page: '1' }

  const { _id } = req.body
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  const redirectUrl = `${PATH_MAIN}?rpp=${rpp}&page=${page}`

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_sessions)

    //=== Session เก็บข้อมูล _id ไม่เป็น ObjectId สามารถลบได้เลย โดยไม่ต้องแปลง new ObjectId
    // const deleteResult = await collection.deleteOne({ _id: new ObjectId(_id) })
    const deleteResult = await collection.deleteOne({ _id: _id })
    if (deleteResult.deletedCount === 1) {
      req.flash('msg', { class: "green", text: `ลบ "${_id}" เรียบร้อยแล้ว` })
      return res.redirect(redirectUrl)
    } else {
      req.flash('msg', { class: "red", text: `ไม่พบ "${_id}"{{sep}}อาจจะถูกลบไปแล้ว` })
      return res.redirect(redirectUrl)
    }
  } catch (err) {
    req.flash('msg', { class: "red", text: err.message })
    return res.redirect(redirectUrl)
  } finally {
    client.close();
  }
})



//=============================================
// ล้างโดยใช้ AJAX
//
router.get( PATH_CLEAR, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)
  const rpp = Number(req.query.rpp) || 20
  const page = Number(req.query.page) || 1

  const client = new MongoClient(global.dbUrl);
  try{
    const db = client.db(global.dbName);
    const collection = db.collection(global.dbColl_sessions)
    
    //=== ลบเซสชั่นที่ไม่มีคีย์ isAuth - ไม่ได้ login 
    const rtn = await collection.deleteMany({
      'session.isAuth': { $exists: false }
      // session: { $exists: true }, // ต้องมี session
      // 'session.isAuth': { $ne: true } // isAuth ใน session ต้องไม่เท่ากับ true (หรือไม่มี)
    });
    const redirectUrl = `${PATH_MAIN}?rpp=${rpp}&page=${page}`
    if(rtn.acknowledged == true){
      req.flash('msg', {
        class: "green", 
        text: `ล้างเซสชั่นว่างจำนวน ${rtn.deletedCount} เซสชั่น{{sep}}เรียบร้อยแล้ว` 
      })
      res.redirect(redirectUrl)
    }else{
      req.flash('msg', { class: "red", text: `Error while deleting session` })
      res.redirect(redirectUrl)
    }
  }catch(err){
    req.flash('msg', { class: "red", text: err.message })
    res.redirect(redirectUrl)
  }finally{
    client.close()
  }

})


export default router


