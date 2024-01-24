export class general {
    static shufle = true              //перемешать ли позиции кошельков между собой?
    static rpc = "https://eth.llamarpc.com"        //RPC Ethereum можно вставить любую
    static apikey = ""                             //api ключ для вывода с OKX
    static secret = ""                             //secret для вывода с OKX
    static pass = ""                               //passPhrase от api OKX (именно от API!)
    static minAmount = 0.1                         //минимальная сумма для вывода
    static maxAmount = 1                           //максимальная сумма для вывода (выбирается случайное между)
    static remainAmount = 0.05                     //Какой баланс в ETH оставить для комисии при депозите в EigenLayer
    static minDelayAfterAction = 100               //в секундах. Минимальная задержка после действия
    static maxDelayAfterAction = 1000              //максимальаня задержка после действия
    static gas = 100                               //гвей при котором будет работать скрипт
    static minDelayAfterWallet = 10                //минимальная задержка после обработки кошелька
    static maxDelayAfterWallet = 1000              //максимальная задержка после обработки кошелька
    static cex = false                             //true - будет выполнено  | false - не будет выполнено
    static swellDeposit = false
    static approve = false                         //делается апрув для контракта ейгена, апрувит сумму на 10% больше баланса
    static eigenDeposit = false
}