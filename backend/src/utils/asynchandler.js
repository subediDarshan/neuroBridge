const asynchandler=(fn)=>async(req,res,next)=>{
    try{
       return await fn(req,res,next);
    }
    catch(error){
       return res.status(500).json({
        success:false,
        message:error.message
       }) // console.log("error is asynch handler ",error);
    }
}
export {asynchandler};