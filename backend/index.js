const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const auctionRoutes = require('./src/routes/auction');
const bidRoutes = require('./src/routes/bid');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { initSocket } = require('./src/webSocket/socketServer');
const uploadRoutes = require('./src/routes/upload');
const adminRoutes=require('./src/routes/admin');

dotenv.config();

// app.post('/postdata', (req,res)=>{
//     const {email,username,password_hash,full_name,balance}=req.body;
//     const insert_query = `
//     INSERT INTO users
//     (email, username, password_hash, full_name, balance)
//     VALUES ($1, $2, $3, $4, $5)
//   `;
//     con.query(insert_query,[email,username,password_hash,full_name,balance],(err,result)=>{
//       if(err){
//         console.log('error occured');
//         res.send(err);
//       }
//       else{
//         console.log(result);
//         res.send('data stored')
//       }
//     })
// });

// app.get('/getdata',(req,res)=>{
//     const fetch_query=`select * from users`;
//     con.query(fetch_query,(err,result)=>{
//       if(err){
//         console.log(err);
//         res.send('error occured ....');
//       }
//       else{
//          res.send(result);
//          console.log('data fetched');
//       }
//     })
// });

// app.get('/getbyname/:username',(req,res)=>{
//   const username=req.params;
//   const fetch_query="select balance from users where username = $1";
//   con.query(fetch_query,[username],(err,result)=>{
//     if(err){
//     console.log(err);
//     res.send('error occured ..,,');
//     }
//     else{
//       console.log('success');
//       res.send(result);
//     }

//   })
// });

// app.put('/update/:username',async(req,res)=>{
//   const username=req.params.username;
//   const email=req.body.email;

//   const update_query="update users set email=$1 where username=$2";

//   const result=await con.query(update_query,[email,username]);

//   if(result){
//     console.log('success////');
//     res.send(result);
//   }
//   else{
//     console.log(err);
//     res.send('error occured ..,,');
//   }

// });

const app = express();
const server = createServer(app);

//initialize socket server
initSocket(server);

const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cookieParser());

// CORS - Allow frontend to make requests with cookies
app.use(cors({
  origin: 'http://localhost:5173',  // Frontend URL
  credentials: true  // Allow cookies
}));

app.use('/api/auth', authRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/upload', uploadRoutes);
app.use('api/admin/',adminRoutes);

//listen on server
server.listen(port, () => {
  console.log(`server is running on port ${port}`);
})



