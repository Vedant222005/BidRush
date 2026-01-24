const con=require('../config/db');  

const createAuction=async(req,res)=>{
     try{
         const {seller_id,title,description,category,starting_bid,end_time}=req.body;

         const insert_query=`
         INSERT INTO auctions (seller_id, title, description, category, starting_bid, end_time)
         VALUES ($1, $2, $3, $4, $5, $6)`;  

         const result=await con.query(insert_query,[seller_id,title,description,category,starting_bid,end_time]);
        
         console.log(result);
         res.status(200).json({message:'Auction created successfully',result}); 
        
     }
     catch(err){
         res.status(500).json({message:'Failed to create auction'});    
     }
};

const deleteAuction=async(req,res)=>{
    try{
        const {id}=req.params;
        const delete_query="delete from auctions where id=$1";

        const result=await con.query(delete_query,[id]);
        console.log(result);
        res.status(200).json({message:'Auction deleted successfully',result});
    }
    catch(err){
        res.status(500).json({message:'Failed to delete auction'});    
    }
};

const updateAuction=async(req,res)=>{
    try{
        const {id}=req.params;
        const update_body=req.body;
        const update_query="update auctions set title=$1, category=$2 where id=$3";
        const result=await con.query(update_query,[update_body.title,update_body.category,id]);
        console.log(result);
        res.status(200).json({message:'Auction updated successfully',result});
    }
    catch(err){
        res.status(500).json({message:'Failed to update auction'});    
    }
};

const getAllAuctions=async(req,res)=>{
    try{
        const fetch_query="select * from auctions";
        const result=await con.query(fetch_query);
        console.log(result);
        res.status(200).json({message:'Auction fetched successfully',result});
    }
    catch(err){
        res.status(500).json({message:'Failed to get auction'});    
    }
}

const getUserAuctions=async(req,res)=>{
    try{
        const {userId}=req.params;
        const fetch_query="select * from auctions where seller_id=$1";
        const result=await con.query(fetch_query,[userId]);
        console.log(result);
        res.status(200).json({message:'User auction fetched successfully',result});
    }
    catch(err){
        res.status(500).json({message:'Failed to get user auction'});    
    }
}

module.exports={createAuction,deleteAuction,updateAuction,getAllAuctions,getUserAuctions};
