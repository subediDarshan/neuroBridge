

import { asynchandler } from "../utils/asynchandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
const verifyJwt= asynchandler(async(req,res,next)=>{
const accessToken=req.cookies?.accessToken;
     const token=jwt.verify(accessToken,process.env.ACCESS_TOKEN_SECRET_KEY);
     if(!token){
        return res.status(403).json({
            message:" user is not loggedin "
        })
     }
     const user=await User.findById(token._id).select("-password -refreshToken");
     req.user=user;
     next();

})


export default verifyJwt;