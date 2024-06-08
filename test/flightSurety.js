var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    let funds = web3.utils.toWei('10', 'ether');
    let timestamp = Math.floor(Date.now() / 1000);

    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {
        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");
    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSurety.setTestingMode(true);
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);
    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
        // ARRANGE
        let newAirline = accounts[2];

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(newAirline, "Second Airline", { from: config.firstAirline });
        }
        catch(e) {
            //console.log(e);
        }
        let result = await config.flightSuretyData.isAirline.call(newAirline);

        // ASSERT
        assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
    });

    // ===== Demonstrated either with Truffle test or by making call from client Dapp ===== //
    it('(airline) It is possible to register an Airline using registerAirline() if it is already funded', async () => {
        // ARRANGE
        let secondAirline = accounts[2];

        // ACT
        try {
            await config.flightSuretyData.fund({ from: config.firstAirline, value: funds });

            await config.flightSuretyApp.registerAirline(secondAirline, "Second Airline", { from: config.firstAirline });
        }
        catch(e) {
            console.log(e);
        }

        let result = await config.flightSuretyData.isAirline.call(secondAirline);

        // ASSERT
        assert.equal(result, true, "The airline can register another airline if it does not provide funding");
    });

    it('(airline) Only existing airline may register a new airline until there are at least four airlines registered', async () => {
        // ARRANGE
        let thirdAirline = accounts[3];
        let fourthAirline = accounts[4];

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(thirdAirline, "Third Airline", { from: config.firstAirline });
            await config.flightSuretyApp.registerAirline(fourthAirline, "Fourth Airline", { from: config.firstAirline });
        }
        catch(e) {
            console.log(e);
        }

        let result1 = await config.flightSuretyData.isAirline.call(thirdAirline);
        let result2 = await config.flightSuretyData.isAirline.call(fourthAirline);

        // ASSERT
        assert.equal(result1, true, "Airline may register another airline if there are less than four airlines registered");
        assert.equal(result2, true, "Airline may register another airline if there are less than four airlines registered");
    });

    it('(airline) Registering the fifth airline onwards requires the consensus of many parties', async () => {
        // ARRANGE
        let fifthAirline = accounts[5];

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(fifthAirline, "Fifth Airline", { from: config.firstAirline });
        }
        catch(e) {
            console.log(e);
        }

        let result = await config.flightSuretyData.isAirline.call(fifthAirline);

        // ASSERT
        assert.equal(result, false, "Fifth airline cannot be registered without the consent of many parties");

        // ACT - vote for the fifth airline by other airlines
        try {
            await config.flightSuretyData.fund({ from: accounts[2], value: funds });

            await config.flightSuretyApp.registerAirline(fifthAirline, "Fifth Airline", { from: accounts[2] });
        } catch (e) {
            console.log(e);
        }

        result = await config.flightSuretyData.isAirline.call(fifthAirline);

        // ASSERT
        assert.equal(result, true, "Fifth airline should be registered after enough votes");
    });

    it('(flight) Airline cannot register for flights without registration', async () => {
        // ARRANGE
        var flightKey = await config.flightSuretyData.getFlightKey.call(config.testAddresses[2], "F1", timestamp);

        // ACT
        try {
            await config.flightSuretyApp.registerFlight(config.testAddresses[2], "F1", timestamp);
        } catch (e) {
            //console.log(e);
        }

        result = await config.flightSuretyApp.isFlight.call(flightKey);

        // ASSERT
        assert.equal(result, false, "flight has not been created yet");
    });

    it('(flight) Airline can register for flights once registered', async () => {
        // ARRANGE
        var flightKey = await config.flightSuretyData.getFlightKey.call(config.firstAirline, "F2", timestamp);

        // ACT
        try {
            await config.flightSuretyApp.registerFlight(config.firstAirline, "F2", timestamp);
        } catch (e) {
            console.log(e);
        }

        result = await config.flightSuretyApp.isFlight.call(flightKey);

        // ASSERT
        assert.equal(result, true, "flight has not been created yet");
    });

    it('(passenger) Passengers cannot purchase flight insurance for more than 1 ether', async () => {
        // ARRANGE
        let passenger = accounts[6];
        let fundInsurance = web3.utils.toWei('2', 'ether');
        let checkPay = false;
        var flightKey = await config.flightSuretyData.getFlightKey.call(config.firstAirline, "F2", timestamp);

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(config.firstAirline, "F2", timestamp, { from: passenger, value: fundInsurance });
        } catch (e) {
            checkPay = true;
        }

        // ASSERT
        let insurance = await config.flightSuretyData.viewInsurance.call(passenger, flightKey);
        assert.notEqual(insurance.passenger, passenger, "Passengers cannot purchase flight insurance");

        assert.equal(checkPay, true, "Passengers cannot purchase flight insurance");
    });

    it('(passenger) Passenger buys Insurance for the flight', async () => {
        // ARRANGE
        let passenger = accounts[6];
        let fundInsurance = web3.utils.toWei('0.5', 'ether');
        var flightKey = await config.flightSuretyData.getFlightKey.call(config.firstAirline, "F2", timestamp);

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(config.firstAirline, "F2", timestamp, { from: passenger, value: fundInsurance });
        } catch (e) {
            console.log(e);
        }

        // ASSERT
        let insurance = await config.flightSuretyData.viewInsurance.call(passenger, flightKey);
        assert.equal(insurance.passenger, passenger, "Passengers cannot purchase flight insurance");
        assert.equal(insurance.amount.toString(), fundInsurance, "Insurance amount should be 0.5 ether");
    });

    it('(passenger) Flight is delayed due to airline error, passengers will receive a credit of 1.5 times the amount paid', async () => {
        // ARRANGE
        let passenger = accounts[6];
        var flightKey = await config.flightSuretyData.getFlightKey.call(config.firstAirline, "F2", timestamp);

        let status = await config.flightSuretyApp.flightStatus.call(flightKey);
        assert.equal(status, STATUS_CODE_UNKNOWN, "flight status");

        // ACT
        try {
            await config.flightSuretyApp.processFlightStatus(config.firstAirline, "F2", timestamp, STATUS_CODE_LATE_AIRLINE);
        } catch (e) {
            console.log(e);
        }

        status = await config.flightSuretyApp.flightStatus.call(flightKey);
        assert.equal(status, STATUS_CODE_LATE_AIRLINE, "flight status");

        // ASSERT
        let result = await config.flightSuretyData.viewCredits.call(passenger);
        // 0.5 ether receives x1.5 = 0.75 ether
        assert.equal(result.toString(), web3.utils.toWei("0.75", "ether"), "Insurance amount should be 1 ether");
    });

    it('(passenger) Passenger can withdraw any funds owed to them as a result of receiving credit for insurance payout', async () => {
        // ARRANGE
        let passenger = accounts[6];

        // Get balance before action
        let balanceBeforeWei = await web3.eth.getBalance(passenger);
        let balanceBeforeEth = web3.utils.fromWei(balanceBeforeWei, 'ether');
        //console.log(`Balance before action: ${balanceBeforeEth} ETH`);

        let result = await config.flightSuretyData.viewCredits.call(passenger);
        assert.equal(result.toString(), web3.utils.toWei("0.75", "ether"), "Insurance amount should be 1 ether");

        // ACT
        try {
            await config.flightSuretyApp.payInsurance({ from: passenger });
        } catch (e) {
            console.log(e);
        }

        // ASSERT
        result = await config.flightSuretyData.viewCredits.call(passenger);
        assert.equal(result.toString(), web3.utils.toWei("0", "ether"), "Insurance amount should be 1 ether");

        // Get balance after action
        let balanceAfterWei = await web3.eth.getBalance(passenger);
        let balanceAfterEth = web3.utils.fromWei(balanceAfterWei, 'ether');
        //console.log(`Balance after action: ${balanceAfterEth} ETH`);

        //console.log(`Balance change: ${balanceAfterEth - balanceBeforeEth} ETH`);
        assert(balanceAfterEth > balanceBeforeEth, "Balance should decrease after funding");
    });

});
