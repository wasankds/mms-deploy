import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import flash from 'connect-flash'
import MongoDBSession from 'connect-mongodb-session' 
import { createServer } from 'node:http';
import { Server } from 'socket.io'
const IS_PRODUCTION = process.env.IS_PRODUCTION == 1 ? true : false
const LOCALHOST = process.env.LOCALHOST
const DOMAIN_URL = process.env.DOMAIN_URL
const DOMAIN_WWW_URL = process.env.DOMAIN_WWW_URL
const PORT = IS_PRODUCTION == 0 ? process.env.PORT_DEV : process.env.PORT_PRODUCTION
const RANDOM_DATA = process.env.RANDOM_DATA == 1 ? true : false
const routesFolder = IS_PRODUCTION ? 'routes-min' : 'routes'
global.IS_PRODUCTION = IS_PRODUCTION
global.PROJECT_DIR = process.cwd()
global.DOMAIN_ALLOW = IS_PRODUCTION == 0 ? `${LOCALHOST}:${PORT}` : `${DOMAIN_URL}`
global.mymoduleFolder = IS_PRODUCTION ? 'mymodule-min' : 'mymodule'
// await import(`./myGlobal.js`)
await import(`./${global.mymoduleFolder}/myGlobal.js`)
await import(`./${global.mymoduleFolder}/myScheduleBackupDb.js`)
if(RANDOM_DATA) await import(`./${global.mymoduleFolder}/myRandomData.js`)
const app = express()
const server = createServer(app)
const io = new Server(server)
global.io = io;

//=== เข้าใช้ได้จากภายนอกเฉพาะ โดเมนที่กำหนดไว้
// - เข้าจากเลข IP โดยตรงจะไม่ผ่าน
// - ดูเหมือนเข้าจาก www. จะยังไม่ผ่าน อาจจะติด cloudflare tunnel ก็ได้
if(IS_PRODUCTION){
  const allowedHosts = [
    DOMAIN_URL.replace(/https:\/\/|http:\/\//, '').toLowerCase(),
    DOMAIN_URL.replace(/https:\/\/|http:\/\//, '').replace(/^www\./, '').toLowerCase(),
    DOMAIN_WWW_URL.replace(/https:\/\/|http:\/\//, '').toLowerCase(),
    DOMAIN_WWW_URL.replace(/https:\/\/|http:\/\//, '').replace(/^www\./, '').toLowerCase()
  ];
  if (IS_PRODUCTION == 0) {
    allowedHosts.push(LOCALHOST.toLowerCase());
    allowedHosts.push(LOCALHOST.replace(/https:\/\/|http:\/\//, '').toLowerCase());
  }
  app.use((req, res, next) => {
    const host = req.headers.host && req.headers.host.split(':')[0];
    if (!allowedHosts.includes(host)) {
      return res.status(403).send('Forbidden');
    }
    next();
  });
}

//=== Sessionss
const MongoStore = MongoDBSession(session)
app.use(session({
  secret: 'mms.node.apps.key.sign.cookie',
  cookie: {
    maxAge: 1000*60*60*24*30,
    // secure: IS_PRODUCTION ? true : false,
    httpOnly: IS_PRODUCTION ? true : false,
  },
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    uri: dbUrl,
    databaseName: dbName,
    collection: dbColl_sessions,
  }),
}))
app.set('view engine', 'ejs')
app.use(flash())
app.use(cookieParser())
app.use(express.json({limit:'50mb'}))
app.use(express.urlencoded({extended:true,limit:'50mb'}))
app.use(express.static(global.folderPublic))
app.use((req, res, next) => {
  const allowedOrigins = [ global.DOMAIN_ALLOW ]
  if(!IS_PRODUCTION){ // development - เพิ่ม localhost และ Five Server
    allowedOrigins.push(`${LOCALHOST}:${PORT}`)
    allowedOrigins.push(`http://127.0.0.1:5500`)
  }
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  } else {
    res.header('Access-Control-Allow-Origin', 'null') 
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})
app.use('/', (req, res, next) => { req.io = io; next() })
if( process.env.USE_STARTAPP_ROUTER == 1 )
app.use((await import(`./${routesFolder}/startAppRouter.js`)).default);
app.use((await import(`./${routesFolder}/homeRouter.js`)).default) ;
app.use((await import(`./${routesFolder}/loginRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageSettingsRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageSettingsSystemRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageSessionsRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageUsersRouter.js`)).default);
app.use((await import(`./${routesFolder}/userInfoRouter.js`)).default);
app.use((await import(`./${routesFolder}/passwordRouter.js`)).default);
app.use((await import(`./${routesFolder}/devicesRouter.js`)).default);
app.use((await import(`./${routesFolder}/devicesSortingRouter.js`)).default);
app.use((await import(`./${routesFolder}/keysDefinitionRouter.js`)).default);
app.use((await import(`./${routesFolder}/dashboardRouter.js`)).default);
app.use((await import(`./${routesFolder}/dataInRouter.js`)).default);
app.use((await import(`./${routesFolder}/dataByIdRouter.js`)).default);
app.use((await import(`./${routesFolder}/dashboardSwitchRouter.js`)).default);
app.use((await import(`./${routesFolder}/dataInSwitchRouter.js`)).default);
app.use((await import(`./${routesFolder}/alertsRouter.js`)).default);
app.use((await import(`./${routesFolder}/reportByIdRouter.js`)).default);
// app.use((await import(`./${routesFolder}/mapRouter.js`)).default);
app.use( (err, req, res, next) => {
  res.status(err.status || 500);
  const errHtml = `<h1 style="color:blue">กำลังอัปเดทข้อมูล</h1>
    <p style="color:red">"err.status ===> " ${err.status}</p>
    <p style="color:red">"err.stack ===> " ${err.stack}</p>`
  res.send(errHtml)
  next()
})
app.get('*', (req,res) => {
  res.status(404).sendFile(file404)
})
server.listen(PORT, () => {
  //  process.stdout - แจ้งใน terminal แน่นอน
  process.stdout.write(`========== Server@${DOMAIN_ALLOW} ===========\n`);
  process.stdout.write(`IS_PRODUCTION ===> ${IS_PRODUCTION}\n`);
  process.stdout.write(`global.DOMAIN_ALLOW ===> ${global.DOMAIN_ALLOW}\n`);
  process.stdout.write(`Process PID ===> ${process.pid}\n`);
})



// // =============================================================
// // เสียงแจ้งเตือน
// // uncaughtException = จับข้อผิดพลาดที่ไม่ได้จับไว้
// // unhandledRejection = จับ Promise ที่ไม่ได้จับข้อผิดพลาดไว้
// process.on('uncaughtException', (err) => {
//   console.error('There was an uncaught error', err)
// })
// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection at:', promise, 'reason:', reason)
// })