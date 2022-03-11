/**
 * Copyright 2022 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');
 
 const Helpers = require('../../../helpers');
 
 const BridgeContract = artifacts.require("Bridge");
 const CentrifugeAssetContract = artifacts.require("CentrifugeAsset");
 const GenericHandlerContract = artifacts.require("GenericHandler");
 const BasicFeeHandlerContract = artifacts.require("BasicFeeHandler");
 
 contract('Bridge - [fee]', async (accounts) => {
     const originDomainID = 1;
     const destinationDomainID = 2;
     const blankFunctionSig = '0x00000000';
     const blankFunctionDepositerOffset = 0;
     const relayer = accounts[0];
     const feeData = '0x0';
 
     let BridgeInstance;
     let BasicFeeHandlerInstance;
     let GenericHandlerInstance;
     let resourceID;
     let depositData;
     let initialResourceIDs;
     let initialContractAddresses;
     let initialDepositFunctionSignatures;
     let initialDepositFunctionDepositerOffsets;
     let initialExecuteFunctionSignatures;
 
     beforeEach(async () => {
         await Promise.all([
             CentrifugeAssetContract.new().then(instance => CentrifugeAssetInstance = instance),
             BridgeInstance = BridgeContract.new(originDomainID, [relayer], 0, 100).then(instance => BridgeInstance = instance)
         ]);
 
         resourceID = Helpers.createResourceID(CentrifugeAssetInstance.address, originDomainID)
         initialResourceIDs = [resourceID];
         initialContractAddresses = [CentrifugeAssetInstance.address];
         initialDepositFunctionSignatures = [blankFunctionSig];
         initialDepositFunctionDepositerOffsets = [blankFunctionDepositerOffset];
         initialExecuteFunctionSignatures = [blankFunctionSig];
 
         GenericHandlerInstance = await GenericHandlerContract.new(
             BridgeInstance.address);
         BasicFeeHandlerInstance = await BasicFeeHandlerContract.new(
             BridgeInstance.address);
 
         await BridgeInstance.adminSetGenericResource(GenericHandlerInstance.address, resourceID,  initialContractAddresses[0], initialDepositFunctionSignatures[0], initialDepositFunctionDepositerOffsets[0], initialExecuteFunctionSignatures[0]);
             
         depositData = Helpers.createGenericDepositData('0xdeadbeef');
     });
 
     it('distribute fees', async () => {
         await BridgeInstance.adminChangeFeeHandler(BasicFeeHandlerInstance.address);
         await BasicFeeHandlerInstance.changeFee(Ethers.utils.parseEther("1"));
         assert.equal(web3.utils.fromWei((await BasicFeeHandlerInstance._fee.call()), "ether"), "1");
 
         // check the balance is 0
         assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "0");
         await BridgeInstance.deposit(destinationDomainID, resourceID, depositData, feeData, {value: Ethers.utils.parseEther("1")})
         assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BridgeInstance.address)), "ether"), "0");
         assert.equal(web3.utils.fromWei((await web3.eth.getBalance(BasicFeeHandlerInstance.address)), "ether"), "1");
 
         let b1Before = await web3.eth.getBalance(accounts[1]);
         let b2Before = await web3.eth.getBalance(accounts[2]);
 
         let payout = Ethers.utils.parseEther("0.5")
         // Transfer the funds
         TruffleAssert.passes(
             await BasicFeeHandlerInstance.transferFee(
                 [accounts[1], accounts[2]], 
                 [payout, payout]
             )
         )
         b1 = await web3.eth.getBalance(accounts[1]);
         b2 = await web3.eth.getBalance(accounts[2]);
         assert.equal(b1, Ethers.BigNumber.from(b1Before).add(payout));
         assert.equal(b2, Ethers.BigNumber.from(b2Before).add(payout));
     })
 });