const express = require('express');
const Server=require('socket.io');
const createServer=require('http');
const cors=require('cors');
const app=express();

const server=new createServer(app);
const io=new Server(server,{
    cors:{
        origin:"*",
        methods:["GET",'POST'],
        credential:true
    }
    
});

app.use(cors({
        origin:"*",
        methods:["GET",'POST'],
        credential:true
}      
));

io.on("connection",(socket)=>{
    console.log('user connected');
    console.log("iD",socket.id);
})

const port = process.env.PORT || 3000;

app.use('/', ()=>{
    console.log("hello ved");
});

server.listen(port, () => {
  console.log(`server is running on port ${port}`);
})

