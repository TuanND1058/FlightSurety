import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

const config = Config['localhost'];
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
const flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const oracles = [];
const ORACLES_COUNT = 20;
const STATUS_CODES = [0, 10, 20, 30, 40, 50];

async function registerOracles() {
    const accounts = await web3.eth.getAccounts();
    const fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();

    for (let i = 0; i < ORACLES_COUNT; i++) {
        await flightSuretyApp.methods.registerOracle().send({ from: accounts[i], value: fee, gas: 3000000 });
        const indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: accounts[i] });
        oracles.push({ address: accounts[i], indexes });
        console.log(`Oracle Registered: ${accounts[i]} with indexes ${indexes}`);
    }
}

flightSuretyApp.events.OracleRequest({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error);
    console.log(event);

    const { index, airline, flight, timestamp } = event.returnValues;

    oracles.forEach(oracle => {
        if (oracle.indexes.includes(index)) {
            const statusCode = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
            flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode)
                .send({ from: oracle.address, gas: 3000000 })
                .then(result => {
                    console.log(`Oracle response from ${oracle.address} with status code ${statusCode}`);
                }).catch(err => {
                    console.log(`Error from oracle ${oracle.address}:`, err.message);
                });
        }
    });
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
        message: 'An API for use with your Dapp!'
    });
});

registerOracles();

export default app;
