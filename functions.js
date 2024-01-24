import { ethers } from "ethers"
import ccxt from "ccxt"
import winston from 'winston';
import { general } from "./settings.js"
import config from "./config.json" assert {type: "json"}
import abi from "./abi.json" assert {type: "json"}



export async function swellDeposit(key, remainAmount){
    const provider = new ethers.JsonRpcProvider(general.rpc)
    const wallet = new ethers.Wallet(key, provider)
    const balance = await provider.getBalance(wallet.address)
    const depositContract = new ethers.Contract(config.swell.depositContract, abi.swellDeposit, provider)
    const remainAmountWei = ethers.parseUnits(remainAmount.toString(), "ether")
    const fakeEstimate = await depositContract.connect(wallet).deposit.estimateGas({value: 1n})
    const gasPrice = (await provider.getFeeData()).gasPrice
    const amount = balance - (fakeEstimate * (gasPrice * 105n / 100n) + remainAmountWei)
    const txEstimate = await depositContract.connect(wallet).deposit.estimateGas({value: amount})
    const tx = await depositContract.connect(wallet).deposit(
        {
            value: amount,
            gasPrice: gasPrice * 105n / 100n
        }
    )

    await tx.wait()
    logger.info(`${ethers.formatUnits(amount, "ether")} ETH was deposited in Swell - ${tx.hash}`)
}

export async function approveForEigen(key){
    const provider = new ethers.JsonRpcProvider(general.rpc)
    const wallet = new ethers.Wallet(key, provider)
    const tokenContract = new ethers.Contract(config.swell.tokenAddress, abi.ERC20, provider)
    const balance = await tokenContract.balanceOf(wallet.address)
    const allowance = await tokenContract.allowance(wallet.address, config.eigen.depositContract)
    if(allowance < balance){
        const txEstimate = await tokenContract.connect(wallet).approve.estimateGas(
            config.eigen.depositContract,
            balance * 110n / 100n
        )

        const approve = await tokenContract.connect(wallet).approve(
            config.eigen.depositContract,
            balance * 110n / 100n
        )
        await approve.wait()
        logger.info(`Token was approved for eigen - ${approve.hash}`)
    }
    logger.info(`Token approved for eigen`)
}


export async function eigenDepositSwell(key){
    try{
    const provider = new ethers.JsonRpcProvider(general.rpc)
    const wallet = new ethers.Wallet(key, provider)
    const eigenContract = new ethers.Contract(config.eigen.depositContract, abi.eigen, provider)
    const tokenContract = new ethers.Contract(config.swell.tokenAddress, abi.ERC20, provider)

    const balance = await tokenContract.balanceOf(wallet.address)
    const gasPrice = (await provider.getFeeData()).gasPrice
    const txEstimate = await eigenContract.connect(wallet).depositIntoStrategy.estimateGas(
        config.eigen.strategy.sweth,
        config.swell.tokenAddress,
        balance,
        {
            value: 0n,
            gasPrice: gasPrice
        }
    )

    const tx = await eigenContract.connect(wallet).depositIntoStrategy(
        config.eigen.strategy.sweth,
        config.swell.tokenAddress,
        balance,
        {
            value: 0n,
            gasPrice: gasPrice * 105n / 100n
        }
    )

    await tx.wait()
    }catch(e){
        if(e.code == "INSUFFICIENT_FUNDS"){
            logger.error(`Not enough funds for deposit, try to set lowwer GAS`)
        }else{
            console.log(e)
        }
    }
}


export async function withdrawOKX(apiKey, secret, pass, token, amount, address, network){
    try{
    logger.info(`Starting the withdrawal from OKX, amount is ${amount + token}`)
    let networkName = await getNetworkNameOKX(network)
    const cexAccount = new ccxt.okx({
        'apiKey': apiKey,
        'secret': secret,
        'password': pass,
        'enableRateLimit': true
    })

        let subAccounts = await cexAccount.privateGetUsersSubaccountList()
        let accs = []
        for(let acc of subAccounts.data){
            accs.push(acc.subAcct)
        }

        for(let acc of accs){
            let subBalances = await cexAccount.privateGetAssetSubaccountBalances({subAcct: acc, currency: token})
            if(subBalances.data.length > 0){
                for(let balances of subBalances.data){
                    if(balances.ccy == token){
                        // nonZeroAccs.push({
                        //     name: acc,
                        //     balances: balances.availBal
                        // })
                        await cexAccount.transfer(token, balances.availBal, 'funding', 'funding', {
                            type: '2',
                            subAcct: acc
                        })
                    }
                }
            }
        }

    
    const chainName = await cexAccount.fetchCurrencies()
    const withdraw = await cexAccount.withdraw(
        token,
        amount,
        address,
        {
            toAddress: address,
            chainName: chainName[token].networks[networkName].id,
            dest: 4,
            fee: chainName[token].networks[networkName].fee,
            pwd: '-',
            amt: amount,
            network: chainName[token].networks[networkName].network

        }
    )
    logger.info(`${amount + token} was withdrawn to the wallet ${address} in ${network}`)
    }catch(e){
        if(e.name == 'InsufficientFunds'){
            logger.error('Insufficient Funds on OKX account')
            await delayTx(600,1200)
            await withdrawOKX(apiKey, secret, pass, token, amount, address, network)
        }else if (e.name == 'PermissionDenied'){
            logger.error(`OKX IP IS NOT WHITELISTED!!!`)
            await delayTx(600,1200)
            await withdrawOKX(apiKey, secret, pass, token, amount, address, network)
        }else if(e.name == 'InvalidAddress'){
            logger.error('Withdrawal address is not allowlisted')
            await delayTx(600,1200)
            await withdrawOKX(apiKey, secret, pass, token, amount, address, network)
        }else if(e.name == 'ExchangeError'){
            logger.error(`Withdrawals suspended in ${network} network, Waiting 1 hour...`)
            await delayTx(3600,3600)
        }
    }
    await delayTx(400,600)
}


export const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.colorize({
          all: false,
          colors: { error: 'red' } 
        }),
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: "logs.log",
        level: "info"
      })
    ]
});


export async function getNetworkNameOKX(networkName){
    let network
    switch(networkName){
        case "arbitrum" : return network = "Arbitrum One"
        case "base" : return network = "Base"
        case "ethereum" : return network = "ERC20"
        case "linea" : return network = "Linea"
        case "optimism" : return network = "Optimism"
        case "zkSync" : return network = "zkSync Era"
    }
  
}

export async function delayTx(min, max) {           //тут в секундах
    let number = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    //logger.info(`Delay ${number / 1000} seconds after transaction is started...`)
    await delay(number)
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function getRandomAmountCex(low, high) {
    const number = Math.random() * (high - low) + low;
    return Number(number.toFixed(4));
};

export async function gasPriceL1(){
    try{
        let gwei
        do{
            let provider = new ethers.JsonRpcProvider(general.rpc)
            let gasPrice = (await provider.getFeeData()).gasPrice;
            gwei = ethers.formatUnits(gasPrice, 'gwei');
            logger.info(`Checking gwei it's - ${gwei}. Gwei settings - ${general.gas}`)
            await delay(10000)
        }while(general.gas < gwei)
    return gwei;
    } catch(e){
      await gasPriceL1();
    }
}

export async function randomDelay(min, max) {
    let number = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    logger.info(`Delay ${number / 1000} started...`)
    await delay(number)
}