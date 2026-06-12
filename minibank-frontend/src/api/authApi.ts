import axios from "axios";


export const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem("refreshToken");

    if(!refreshToken) throw new Error("No refresh Token available");

    const response = await axios.post('http://localhost:5131/api/auth/refresh', {
        refreshToken : refreshToken
    });

    return response.data; // return {token, refresh token}
}