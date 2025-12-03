import axios from "axios";

export const API = axios.create({
    baseURL: "https://neurobridge-backend-jxm8.onrender.com/api",   // Your backend URL
});
