# Project 2 - Remittance
This is a smart contract named Remittance whereby:
1. There are three people: Alice, Bob & Carol.
2. Alice wants to send funds to Bob, but she only has ether & Bob wants to be paid in local currency.
3. Luckily, Carol runs an exchange shop that converts ether to local currency.

Therefore, to get the funds to Bob, Alice will allow the funds to be transferred through Carol's exchange shop. Carol will collect the ether from Alice and give the local currency to Bob.

The steps involved in the operation are as follows:
1. Alice creates a Remittance contract with Ether in it and a puzzle.
2. Alice sends a one-time-password to Bob; over SMS, say.
3. Alice sends another one-time-password to Carol; over email, say.
4. Bob treks to Carol's shop.
5. Bob gives Carol his one-time-password.
6. Carol submits both passwords to Alice's remittance contract.
7. Only when both passwords are correct, the contract yields the Ether to Carol.
8. Carol gives the local currency to Bob.
9. Bob leaves.
10. Alice is notified that the transaction went through.

Since they each have only half of the puzzle, Bob & Carol need to meet in person so they can supply both passwords to the contract. This is a security measure. It may help to understand this use-case as similar to a 2-factor authentication.

## How to start
1. Run `npm install` to install all the dependencies.
2. Run `truffle compile` to build.
3. Run `truffle develop` to initialize the dev environment.
4. Run `migrate` to deploy the Remittance contract.
5. Run `test` to run the basic test cases.

#### Sample:
```
npm install
truffle compile
truffle develop
migrate
test
```

## How to start web app
1. Run `npm install` to install all the dependencies.
2. Run `truffle compile` to build.
3. Run `./node_modules/.bin/webpack` to build the web app.
4. Run `truffle develop` to initialize the dev environment.
5. Run `migrate` to deploy the Remittance contract.
6. Run `php -S 0.0.0.0:8000 -t ./build/app` to start the web app.
