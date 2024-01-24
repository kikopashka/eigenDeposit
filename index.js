import fs from "fs"
import { ethers } from "ethers"
import { swellDeposit, approveForEigen, eigenDepositSwell, withdrawOKX, logger, getRandomAmountCex, gasPriceL1, randomDelay } from "./functions.js";
import { general } from "./settings.js"
import _ from "lodash"


fs.writeFileSync('logs.log', '');
const privates = fs.readFileSync("private.txt").toString().replace(/\r\n/g,'\n').split('\n');
const addresses = fs.readFileSync("addresses.txt").toString().replace(/\r\n/g,'\n').split('\n');

const pairs = privates.map((privateKey, index) => ({ privateKey, address: addresses[index] }));
let accounts = general.shufle == true ? _.shuffle(pairs) : pairs

for(let i = 0; i < accounts.length; i++){
    try{
    let pk = accounts[i].privateKey
    let address = accounts[i].address
    const provider = new ethers.JsonRpcProvider(general.rpc)
    const wallet = new ethers.Wallet(pk, provider)
    
    logger.info(`Starting procces wallet ${i+1}/${accounts.length+1} - ${wallet.address}`)

    if(general.cex){
        let amount = getRandomAmountCex(general.minAmount, general.maxAmount)
        await withdrawOKX(general.apikey, general.secret, general.pass, "ETH", amount, address, "ethereum")
    }

    if(general.swellDeposit){
        await gasPriceL1()
        await swellDeposit(pk, general.remainAmount)
        await randomDelay(general.minDelayAfterAction, general.maxDelayAfterAction)
    }

    if(general.approve){
        await gasPriceL1()
        await approveForEigen(pk)
        await randomDelay(general.minDelayAfterAction, general.maxDelayAfterAction)
    }

    if(general.eigenDeposit){
        await gasPriceL1()
        await eigenDepositSwell(pk)
        await randomDelay(general.minDelayAfterAction, general.maxDelayAfterAction)
    }
    logger.info(`----${wallet.address} proccessed ----`)
    await randomDelay(general.minDelayAfterWallet, general.maxDelayAfterWallet)
}catch(e){
    console.log(e)
}
}