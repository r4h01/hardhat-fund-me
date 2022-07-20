const { ethers } = require("hardhat")
const { expect, assert } = require("chai")

describe("FundMe", () => {
    let fundMeFactory, fundMe

    beforeEach(async () => {
        fundMeFactory = await ethers.getContractFactory(
            "FundMe"
        )
        fundMe = await fundMeFactory.deploy()
    })

    
})
