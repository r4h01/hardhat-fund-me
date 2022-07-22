const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { assert, expect } = require("chai")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("fundMe", () => {
          let fundMe, deployer
          //* creiamo la variabile per il mock
          let mockV3Aggregator
          const sendValue = ethers.utils.parseEther("1")

          beforeEach(async () => {
              //attraverso ethers.getSigners() possiamo ottenere le chiavi private nedli account in hardhat config sotto i vari network
              // rinkeby: {
              //    ...
              //     accounts: [PRIVATE_KEY],
              // }
              // const accounts = await ethers.getSigners()
              // const accountZero = accounts[0]
              //oppure possiamo estrarre deployer da getNamedAccounts
              deployer = (await getNamedAccounts()).deployer
              //con fixture possiamo deployare in test tutti i contratti
              //presenti nella cartella deploy
              await deployments.fixture(["all"])
              //con la funzione getContract otteniamo la versione più recente del contratto deployato
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", () => {
              it("sets the aggregator address correctly", async () => {
                  const response = await fundMe.getPriceFeed()
                  //*visto che lo testiamo in locale, dobbiamo importare il mock di preceaggregator
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          describe("fund", async () => {
              it("fail when the amount of eth is not greater than 50 usd", async () => {
                  //utilizzando expect possiamo usare waffle che ci permette di testare quando
                  //le funzione hanno revert, questo perchè altrimenti il test si spaccherebbe
                  await expect(
                      fundMe.fund({ value: ethers.utils.parseEther("0.02") })
                  ).to.be.revertedWith("FundMe__NotEnoughEth")
              })

              it("return the amount of ether to ben sent", async () => {
                  await expect(fundMe.getEthUsdValue()).to.emit(
                      fundMe,
                      "EthInUsd"
                  )
              })

              it("update the amount funded data structure", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })

              it("Adds funder to array of funders", async () => {
                  await fundMe.fund({ value: sendValue })
                  const funder = await fundMe.getFunder(0)
                  assert.equal(funder, deployer)
              })
          })

          describe("withdraw", async () => {
              //dato che per testare la funzione withdraw c'è bisogno che lo smart contract abbia al suo interno egli ethers
              //conviene farlo attraverso un befforeEach e chiamare la funzione fund
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })

              it("withdraw ETH from a single founder", async () => {
                  //Arrange vogliamo verificare che effettivamente ho prelevato
                  const startingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const startingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  //abbiamo bisogno del gas cost, con le graffe estrapolo le due variabili dalla transactionReceipt
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Assert
                  //Con il fatto che lavoriamo con BigNumber, possiamo utilizzare add invece del +
                  //il problema è che il deployer spenderà un po' di gas per chiamare la funzione
                  //utilizziamo le variabili nella transaction receipt per ottenerlo --> ricorda gasUsed * effectiveGasPrice otteniamo il costo del gas
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })

              it("Allows us to withdraw with multiple funders", async () => {
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const startingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )
                  //Make sure that the funders are reset properly
                  await expect(fundMe.getFunder(0)).to.be.reverted
                  for (let i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })

              it("Only allows the owner to withdraw", async () => {
                  const accounts = await ethers.getSigners()
                  const attackerConnectedContract = await fundMe.connect(
                      accounts[1]
                  )
                  await expect(
                      attackerConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })

          describe("cheaperWithdraw", async () => {
              //dato che per testare la funzione cheaperWithdraw c'è bisogno che lo smart contract abbia al suo interno egli ethers
              //conviene farlo attraverso un befforeEach e chiamare la funzione fund
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })

              it("cheaperWithdraw ETH from a single founder", async () => {
                  //Arrange vogliamo verificare che effettivamente ho prelevato
                  const startingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const startingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  //abbiamo bisogno del gas cost, con le graffe estrapolo le due variabili dalla transactionReceipt
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Assert
                  //Con il fatto che lavoriamo con BigNumber, possiamo utilizzare add invece del +
                  //il problema è che il deployer spenderà un po' di gas per chiamare la funzione
                  //utilizziamo le variabili nella transaction receipt per ottenerlo --> ricorda gasUsed * effectiveGasPrice otteniamo il costo del gas
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })

              it("Allows us to cheaperWithdraw with multiple funders", async () => {
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const startingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Assert
                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  )
                  //Make sure that the funders are reset properly
                  await expect(fundMe.getFunder(0)).to.be.reverted
                  for (let i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })

              it("Only allows the owner to cheaperWithdraw", async () => {
                  const accounts = await ethers.getSigners()
                  const attackerConnectedContract = await fundMe.connect(
                      accounts[1]
                  )
                  await expect(
                      attackerConnectedContract.cheaperWithdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
      })
