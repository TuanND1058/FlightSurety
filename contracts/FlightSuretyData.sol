// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    uint256 private numAirlines = 0;

    struct Airline {
        string name;
        address airline;
        bool isRegistered;
        bool isFunded;
        uint256 numVotes;
    }

    struct Insurance {
        address passenger;
        uint256 amount;
        bool isCredited;
    }

    mapping(address => Airline) private airlines;
    mapping(address => mapping(address => bool)) private voteAirlines;
    mapping(address => mapping(string => Insurance)) private insurances;
    mapping(address => uint256) private passengerCredits;
    address[] private passengers;
    mapping(address => bool) private registeredPassengers;
    mapping(address => bool) private authorizedCallers;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() {
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsCallerAuthorized() {
        require(authorizedCallers[msg.sender], "Caller is not an authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool) {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function authorizeCaller(address _contract) external requireContractOwner {
        authorizedCallers[_contract] = true;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function isAirline(address airline) public view returns (bool) {
        return airlines[airline].isRegistered;
    }

    function isAirlineFunded(address airline) public view returns (bool) {
        return airlines[airline].isFunded;
    }

    function numAirline() public view returns (uint256) {
        return numAirlines;
    }

    function numVotes(address airline) public view returns (uint256) {
        return airlines[airline].numVotes;
    }

    /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address airline, string calldata name, address voter) external requireIsOperational returns (bool) {
        if (numAirlines != 0) {
            require(airlines[voter].isRegistered, "Only registered airlines can register and vote");
            require(airlines[voter].isFunded, "Only funded airlines can register");
        }

        require(!airlines[airline].isRegistered, "Airline is already registered");

        if (numAirlines < 4) {
            airlines[airline] = Airline({
                name: name,
                airline: airline,
                isRegistered: true,
                isFunded: false,
                numVotes: 0
            });

            numAirlines++;
        } else {
            require(!voteAirlines[airline][voter], "Caller has already voted for this airline");

            voteAirlines[airline][voter] = true;
            airlines[airline].numVotes++;

            if (airlines[airline].numVotes >= numAirlines / 2) {
                airlines[airline].name = name;
                airlines[airline].airline = airline;
                airlines[airline].isRegistered = true;

                numAirlines++;
            }
        }

        return true;
    }

    /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address airline, string calldata flight, address passenger, uint256 amount) external payable {
        require(airlines[airline].isRegistered, "Airline is not registered");
        require(airlines[airline].isFunded, "Airline is not funded");

        insurances[passenger][flight] = Insurance({
            passenger: passenger,
            amount: amount,
            isCredited: false
        });

        if (!_hasPassenger(passenger)) {
            registeredPassengers[passenger] = true;
            passengers.push(passenger);
        }
    }

    function _hasPassenger(address passenger) internal view returns (bool) {
        return registeredPassengers[passenger];
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees() external pure {

    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay() external pure {

    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund() public payable {
        require(airlines[msg.sender].isRegistered, "Airline is not registered");
        require(!airlines[msg.sender].isFunded, "Airline is already funded");
        require(msg.value == 10 ether, "Funding must be 10 ether");

        airlines[msg.sender].isFunded = true;
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    fallback() external payable {
        fund();
    }

    receive() external payable {
        fund();
    }

}
