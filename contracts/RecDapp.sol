pragma solidity ^0.8.0;

contract RecDapp {
    struct Rec {
        string data;
        address owner;
    }

    struct Request {
        uint kwh;
        address user;
    }

    mapping(address => Rec) public recs;
    mapping(address => Request) public requests;

    function issueRec(address recAccountAddress, string memory data) public {
        recs[recAccountAddress] = Rec(data, msg.sender);
    }

    function verifyRec(address recAccountAddress, string memory data) public view returns (bool) {
        return keccak256(bytes(recs[recAccountAddress].data)) == keccak256(bytes(data));
    }

    function requestRec(uint kwh) public {
        requests[msg.sender] = Request(kwh, msg.sender);
    }

    function issueAndSellRec(address recAccountAddress, string memory data, uint price) public payable {
        require(msg.value == price, "Incorrect price sent");
        recs[recAccountAddress] = Rec(data, msg.sender);
        payable(msg.sender).transfer(msg.value);
    }
}
