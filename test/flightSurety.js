var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    let funds = web3.utils.toWei('10', 'ether');

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

    it('(passenger) ', async () => {
        // ARRANGE

        // ACT

        // ASSERT

    });

});
