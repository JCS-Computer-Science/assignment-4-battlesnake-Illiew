// Welcome to
// __________         __    __  .__                               __
// \______   \_____ _/  |__/  |_|  |   ____   ______ ____ _____  |  | __ ____
//  |    |  _/\__  \\   __\   __\  | _/ __ \ /  ___//    \\__  \ |  |/ // __ \
//  |    |   \ / __ \|  |  |  | |  |_\  ___/ \___ \|   |  \/ __ \|    <\  ___/
//  |________/(______/__|  |__| |____/\_____>______>___|__(______/__|__\\_____>
//
// This file can be a nice home for your Battlesnake logic and helper functions.
//
// To get you started we've included code to prevent your Battlesnake from moving backwards.
// For more info see docs.battlesnake.com
import express from "express";
import move from "./moveLogic.js";
import req from "express/lib/request.js";
 
const app = express();
app.use(express.json());
 
const config = {
    apiversion: "1",
    author: "ahmed",
    color: "#8d44c2",
    head: "default",
    tail: "default",
};
 
app.get("/", (req, res) => {
    res.json(config);
});
 
app.post("/start", (req, res) => {
    res.sendStatus(200);
});
 
app.post("/move", (req, res) => {
    res.json(move(req.body));
});
 
app.post("/end", (req, res) => {
    res.sendStatus(200);
});
 
const host = "0.0.0.0";
const port = process.env.PORT || 8000;
 
app.listen(port, host, () => {
    console.log(`Running Battlesnake at http://${host}:${port}...`);
});
 