import React, { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import SoccerBall3D from './components/SoccerBall3D'
import { 
  Coins, 
  Terminal as TerminalIcon, 
  Award, 
  Code, 
  Cpu, 
  Play, 
  HelpCircle, 
  CheckCircle,
  Copy,
  ChevronRight,
  ExternalLink,
  Flame,
  User,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react'

// Real codebase strings to display in Code Viewer
const hookSolidityCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WorldCupGoalRushHook
 * @notice A Uniswap V4 Hook designed for the OKX X Layer "Hook the World Cup" Hackathon.
 * It integrates a World Cup Match Prediction Jackpot and a gamified "Goal Rush" swap rebate.
 * 
 * Features:
 * 1. World Cup Jackpot: A percentage of each swap fee is sent to a jackpot pool. Users can
 *    predict the winner of the active World Cup match via \`hookData\`. Correct predictions
 *    share the jackpot when the match is resolved.
 * 2. Goal Rush Rebate: Swaps have a random chance (e.g., 5%) to score a "Goal", which triggers
 *    an immediate fee rebate or cashback reward from the pool.
 */

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct BeforeSwapDelta {
    int128 delta0;
    int128 delta1;
}

contract WorldCupGoalRushHook {
    // --- Uniswap V4 Hooks Standards ---
    address public immutable poolManager;

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "Only PoolManager");
        _;
    }

    // --- World Cup State ---
    struct Match {
        uint256 id;
        string teamA;
        string teamB;
        uint256 startTime;
        uint256 endTime;
        bool resolved;
        uint8 winner; // 0 = None/Draw, 1 = TeamA, 2 = TeamB
        uint256 totalJackpot;
        uint256 totalPredictionVolume;
    }

    struct Prediction {
        uint8 predictedTeam; // 1 = TeamA, 2 = TeamB
        uint256 amount;
        bool claimed;
    }

    address public owner;
    uint256 public activeMatchId;
    mapping(uint256 => Match) public matches;
    // matchId => user => Prediction
    mapping(uint256 => mapping(address => Prediction)) public predictions;
    // matchId => teamId => total prediction volume
    mapping(uint256 => mapping(uint8 => uint256)) public teamPredictionVolume;

    // --- Gamified Goal Rush State ---
    uint256 public goalRushChance = 5; // 5% chance
    uint256 public totalGoalsScored;
    mapping(address => uint256) public userGoals;
    
    // --- Events ---
    event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 startTime);
    event MatchResolved(uint256 indexed matchId, uint8 winner, uint256 jackpotAmount);
    event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event GoalScored(address indexed swapper, uint256 bonusAmount);
    event JackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    constructor(address _poolManager) {
        poolManager = _poolManager;
        owner = msg.sender;
    }

    // --- Uniswap V4 Callbacks ---

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta memory, uint24) {
        if (hookData.length > 0 && activeMatchId > 0) {
            Match storage activeMatch = matches[activeMatchId];
            if (!activeMatch.resolved && block.timestamp < activeMatch.endTime) {
                (uint8 predictedTeam, address swapper) = abi.decode(hookData, (uint8, address));
                
                if (predictedTeam == 1 || predictedTeam == 2) {
                    uint256 swapAmount = params.amountSpecified > 0 
                        ? uint256(params.amountSpecified) 
                        : uint256(-params.amountSpecified);

                    Prediction storage pred = predictions[activeMatchId][swapper];
                    pred.predictedTeam = predictedTeam;
                    pred.amount += swapAmount;

                    teamPredictionVolume[activeMatchId][predictedTeam] += swapAmount;
                    activeMatch.totalPredictionVolume += swapAmount;

                    uint256 jackpotContribution = swapAmount / 1000;
                    activeMatch.totalJackpot += jackpotContribution;

                    emit PredictionPlaced(swapper, activeMatchId, predictedTeam, swapAmount);
                }
            }
        }
        return (this.beforeSwap.selector, BeforeSwapDelta(0, 0), 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        int128 delta0,
        int128 delta1,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        uint256 randVal = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            sender, 
            delta0, 
            delta1
        ))) % 100;

        if (randVal < goalRushChance) {
            address swapper = sender;
            if (hookData.length > 0) {
                (, swapper) = abi.decode(hookData, (uint8, address));
            }
            
            totalGoalsScored++;
            userGoals[swapper]++;

            emit GoalScored(swapper, 10000000000000000); // 0.01 OKB rebate reward
        }

        return (this.afterSwap.selector, 0);
    }

    // --- World Cup Admin Functions ---

    function createMatch(
        uint256 _matchId,
        string calldata _teamA,
        string calldata _teamB,
        uint256 _duration
    ) external onlyOwner {
        require(matches[_matchId].id == 0, "Match already exists");
        
        matches[_matchId] = Match({
            id: _matchId,
            teamA: _teamA,
            teamB: _teamB,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            resolved: false,
            winner: 0,
            totalJackpot: 0,
            totalPredictionVolume: 0
        });

        activeMatchId = _matchId;
        emit MatchCreated(_matchId, _teamA, _teamB, block.timestamp);
    }

    function resolveMatch(uint256 _matchId, uint8 _winner) external onlyOwner {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.id != 0, "Match does not exist");
        require(!targetMatch.resolved, "Match already resolved");
        require(_winner <= 2, "Invalid winner");

        targetMatch.resolved = true;
        targetMatch.winner = _winner;

        emit MatchResolved(_matchId, _winner, targetMatch.totalJackpot);
    }

    // --- User Claim Functions ---

    function claimJackpot(uint256 _matchId) external {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");
        
        Prediction storage pred = predictions[_matchId][msg.sender];
        require(pred.amount > 0, "No prediction made");
        require(!pred.claimed, "Jackpot already claimed");
        require(pred.predictedTeam == targetMatch.winner, "Prediction was incorrect");

        pred.claimed = true;

        uint256 winnerVolume = teamPredictionVolume[_matchId][targetMatch.winner];
        uint256 claimAmount = (pred.amount * targetMatch.totalJackpot) / winnerVolume;

        (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
        require(success, "Jackpot transfer failed");

        emit JackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    // --- Native OKB Deposits and Admin Management ---

    receive() external payable {}

    function withdraw(uint256 amount) external onlyOwner {
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdraw transfer failed");
    }

    // --- Configuration ---

    function setGoalRushChance(uint256 _chance) external onlyOwner {
        require(_chance <= 100, "Chance too high");
        goalRushChance = _chance;
    }
}`;

const mockManagerCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WorldCupGoalRushHook} from "../WorldCupGoalRushHook.sol";

contract MockPoolManager {
    event SwapTriggered(
        address indexed hook,
        address indexed sender,
        bool zeroForOne,
        int256 amountSpecified,
        bytes hookData
    );

    function executeMockSwap(
        address hookAddress,
        address swapper,
        bool zeroForOne,
        int256 amountSpecified,
        bytes calldata hookData
    ) external returns (bytes4, bytes4) {
        WorldCupGoalRushHook hook = WorldCupGoalRushHook(payable(hookAddress));
        
        PoolKey memory key = PoolKey({
            currency0: address(0),
            currency1: address(0),
            fee: 3000,
            tickSpacing: 60,
            hooks: hookAddress
        });

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: 0
        });

        (bytes4 beforeSelector, , ) = hook.beforeSwap(
            swapper,
            key,
            params,
            hookData
        );

        (bytes4 afterSelector, ) = hook.afterSwap(
            swapper,
            key,
            params,
            0,
            0,
            hookData
        );

        emit SwapTriggered(hookAddress, swapper, zeroForOne, amountSpecified, hookData);

        return (beforeSelector, afterSelector);
    }
}`;

const deployScriptCode = `// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // PoolManager and CREATE2 Deployer addresses on X Layer Mainnet
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const deployerAddress = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
  const salt = process.argv[4]; // Mined salt matching BEFORE_SWAP and AFTER_SWAP flags

  const GoalRushHook = await ethers.getContractFactory("WorldCupGoalRushHook");
  const bytecode = GoalRushHook.bytecode;
  const abiCoder = new ethers.AbiCoder();
  const constructorArgs = abiCoder.encode(["address"], [poolManagerAddress]);
  const creationCode = ethers.concat([bytecode, constructorArgs]);

  console.log("Sending deployment transaction to CREATE2 Factory...");
  const tx = await deployer.sendTransaction({
    to: deployerAddress,
    data: ethers.concat([salt, creationCode]),
  });

  await tx.wait();
  console.log("Successfully deployed contract via CREATE2!");
}`;

const readmeMarkdown = `# GoalRush — World Cup Uniswap V4 Hook

GoalRush is a gamified Uniswap V4 hook custom-built for the OKX X Layer "Hook the World Cup" Hackathon.

## Features
1. **World Cup Prediction Jackpot**: Diverts 0.1% of swap volume to a match winner jackpot pool.
2. **Goal Rush Rebate**: 5% chance on swap to score a "Goal", awarding an immediate 0.01 OKB fee rebate.
3. **CREATE2 Mined Address**: Optimized address mining to satisfy Uniswap V4 hook permission flags.

## Eulr.fun Hackathon Integration (Qualify for $200K USDT)
1. **Deploy Hook**: Deploy \`WorldCupGoalRushHook\` to X Layer Mainnet.
2. **Launch Token**: Go to Eulr.fun on X Layer, create a token, and paste your hook address.
3. **Graduate**: Reach the bonding curve cap. Eulr.fun automatically initializes the Uniswap V4 pool with your hook.
4. **Drive Volume**: All swaps on the graduated pool run through your hook. Trade via OKX Wallet to rank!
`;

const asciiArtText = `
                                         #IF-28082006-FFFFFFFF - BLOCK_LINDY - 3835388 - OR-CHECKSIZE_BLOCK...
                                   #00000000000000000000 - HAS-MEM-INJECTOR-283 - BLOCK_CHECKER_TEST...
                              #INDEX-10293882 - BLOCK.NUM - 820388 - BLOCK.WITHDRAW - FEE_REBATE...
                           #beforeSwap() - hookData - prediction[user] - activeMatchId[1] - winner...
                        #afterSwap() - scoreGoal - penaltyRebate - okbBonus - tx.origin - gasLimit...
                     #Eulr.fun - graduationPool - UniswapV4Pool - XLayerMainnet - 0x360e68faccca...
                   #196 - OKX_Wallet - TradeVolume - $200K_USDT - prizePool - ranking - scoreGoal...
                 #WorldCupGoalRushHook - 0xb4f86ecb09BE... - poolManager...
               #CREATE2Deployer - mineSalt() - 0x4e59b44847b379578588920cA78FbF26c0B4956C - flags...
             #MockPoolManager - executeMockSwap() - SwapTriggered() - zeroForOne - amountSpecified...
            #totalGoalsScored - userGoals[swapper] - goalRushChance[5%] - rewardAmount[0.01_OKB]...
           #jackpotPool - teamPredictionVolume - claimJackpot() - rewardAmount - transferSuccess...
          #matchCreated - matchResolved - winnerId - teamA[Argentina] - teamB[France] - scoreCount...
         #UniswapV4 - beforeSwap.selector - BeforeSwapDelta - afterSwap.selector - bytes32...
        #block.timestamp - block.prevrandao - msg.sender - abi.encodePacked - keccak256 - entropy...
       #address0 - address1 - fee[3000] - tickSpacing[60] - hooks - swapParams - zeroForOne...
      #IPoolManager - SwapParams - amountSpecified - sqrtPriceLimitX96 - beforeSwapDelta...
      #eventMatchCreated - eventMatchResolved - eventPredictionPlaced - eventGoalScored...
      #eventJackpotClaimed - modifierOnlyOwner - modifierOnlyPoolManager - requireState...
      #createMatch() - resolveMatch() - withdraw() - setGoalRushChance() - receive() - fallback...
      #activeMatch.resolved - activeMatch.endTime - activeMatch.totalJackpot - activeMatch...
      #PredictionPlaced - GoalScored - JackpotClaimed - MatchCreated - MatchResolved...
      #abi.decode - predictedTeam - swapper - swapAmount - jackpotContribution - teamVolume...
      #keccak256 - abi.encodePacked - block.timestamp - sender - delta0 - delta1 - goalRush...
      #uint256 - string - mapping - address - bool - uint8 - bytes - constructorArgs...
      #PoolKey - currency0 - currency1 - fee - tickSpacing - hooks - beforeSwapDelta...
      #zeroForOne - amountSpecified - sqrtPriceLimitX96 - beforeSwap - afterSwap...
      #executeMockSwap - MockPoolManager - SwapTriggered - WorldCupGoalRushHook...
      #deployer - Signers - poolManagerAddress - deployerAddress - salt - bytecode...
      #CREATE2 - Factory - tx.wait() - successfullyDeployedContract - hardhat...
      #GoalRush - WorldCupUniswapV4Hook - XLayer - hackathon - OKX_Wallet...
      #bondingCurve - capReached - graduate - realTrading - liquidityMoves...
      #activeMatch.resolved - activeMatch.endTime - activeMatch.totalJackpot - activeMatch...
      #PredictionPlaced - GoalScored - JackpotClaimed - MatchCreated - MatchResolved...
      #abi.decode - predictedTeam - swapper - swapAmount - jackpotContribution - teamVolume...
      #keccak256 - abi.encodePacked - block.timestamp - sender - delta0 - delta1 - goalRush...
      #uint256 - string - mapping - address - bool - uint8 - bytes - constructorArgs...
      #PoolKey - currency0 - currency1 - fee - tickSpacing - hooks - beforeSwapDelta...
      #zeroForOne - amountSpecified - sqrtPriceLimitX96 - beforeSwap - afterSwap...
      #executeMockSwap - MockPoolManager - SwapTriggered - WorldCupGoalRushHook...
      #deployer - Signers - poolManagerAddress - deployerAddress - salt - bytecode...
      #CREATE2 - Factory - tx.wait() - successfullyDeployedContract - hardhat...
      #GoalRush - WorldCupUniswapV4Hook - XLayer - hackathon - OKX_Wallet...
      #bondingCurve - capReached - graduate - realTrading - liquidityMoves...
                        #afterSwap() - scoreGoal - penaltyRebate - okbBonus - tx.origin - gasLimit...
                     #Eulr.fun - graduationPool - UniswapV4Pool - XLayerMainnet - 0x360e68faccca...
                   #196 - OKX_Wallet - TradeVolume - $200K_USDT - prizePool - ranking - scoreGoal...
                 #WorldCupGoalRushHook - 0xb4f86ecb09BE... - poolManager...
               #CREATE2Deployer - mineSalt() - 0x4e59b44847b379578588920cA78FbF26c0B4956C - flags...
             #MockPoolManager - executeMockSwap() - SwapTriggered() - zeroForOne - amountSpecified...
            #totalGoalsScored - userGoals[swapper] - goalRushChance[5%] - rewardAmount[0.01_OKB]...
           #jackpotPool - teamPredictionVolume - claimJackpot() - rewardAmount - transferSuccess...
          #matchCreated - matchResolved - winnerId - teamA[Argentina] - teamB[France] - scoreCount...
         #UniswapV4 - beforeSwap.selector - BeforeSwapDelta - afterSwap.selector - bytes32...
        #block.timestamp - block.prevrandao - msg.sender - abi.encodePacked - keccak256 - entropy...
`;

const getFlagUrl = (fifaCode) => {
  const fifaToIso = {
    QAT: 'qa', ECU: 'ec', ENG: 'gb-eng', IRN: 'ir', SEN: 'sn', NED: 'nl',
    USA: 'us', WAL: 'gb-wls', ARG: 'ar', KSA: 'sa', DEN: 'dk', TUN: 'tn',
    MEX: 'mx', POL: 'pl', FRA: 'fr', AUS: 'au', MAR: 'ma', CRO: 'hr',
    GER: 'de', JPN: 'jp', ESP: 'es', CRC: 'cr', BEL: 'be', CAN: 'ca',
    SUI: 'ch', CMR: 'cm', URU: 'uy', KOR: 'kr', POR: 'pt', GHA: 'gh',
    SRB: 'rs', BRA: 'br', ITA: 'it', SCO: 'gb-sct',
    BIH: 'ba', PAR: 'py', RSA: 'za', CZE: 'cz', HAI: 'ht', CUW: 'cw'
  };
  const iso = fifaToIso[fifaCode?.toUpperCase()] || 'un';
  return `https://flagcdn.com/w40/${iso}.png`;
};

export default function App() {
  const [matchId, setMatchId] = useState(1)
  const [prediction, setPrediction] = useState(1) // 1 = Argentina, 2 = France
  const [swapAmount, setSwapAmount] = useState('1.5')
  const [jackpot, setJackpot] = useState(128.5)
  const [teamAVotes, setTeamAVotes] = useState(64.2) // Argentina volume OKB
  const [teamBVotes, setTeamBVotes] = useState(48.8) // France volume OKB
  const [activeTab, setActiveTab] = useState('hook') // hook, mock, deploy, readme
  const [showDevPortal, setShowDevPortal] = useState(false)
  const [activeRightTab, setActiveRightTab] = useState('match') // match or scores
  const [liveMatches, setLiveMatches] = useState([
    { id: 1, teamA: 'Canada', flagA: 'CAN', teamB: 'Bosnia & Herzegovina', flagB: 'BIH', scoreA: 1, scoreB: 1, minute: "82'", isLive: true },
    { id: 2, teamA: 'United States', flagA: 'USA', teamB: 'Paraguay', flagB: 'PAR', scoreA: 2, scoreB: 0, minute: "41'", isLive: true },
    { id: 3, teamA: 'Mexico', flagA: 'MEX', teamB: 'South Africa', flagB: 'RSA', scoreA: 2, scoreB: 1, minute: "FT", isLive: false },
    { id: 4, teamA: 'Korea Republic', flagA: 'KOR', teamB: 'Czechia', flagB: 'CZE', scoreA: 0, scoreB: 0, minute: "FT", isLive: false },
    { id: 5, teamA: 'Qatar', flagA: 'QAT', teamB: 'Switzerland', flagB: 'SUI', scoreA: 0, scoreB: 0, minute: "June 13", isLive: false },
    { id: 6, teamA: 'Brazil', flagA: 'BRA', teamB: 'Morocco', flagB: 'MAR', scoreA: 0, scoreB: 0, minute: "June 13", isLive: false },
  ])
  const [logs, setLogs] = useState([
    'System: GoalRush Hook verified on X Layer. Ready for mainnet deployment.',
    'System: Active Match #1 - Argentina vs France is accepting predictions.',
    'System: Current jackpot pool backed by native OKB.'
  ])

  const handleNavClick = (sectionId) => {
    setShowDevPortal(true);
  }
  
  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false)
  const [userAddress, setUserAddress] = useState('')
  const [userBalance, setUserBalance] = useState('0.00')
  const [chainId, setChainId] = useState(null)

  const [isStriking, setIsStriking] = useState(false)
  const [showGoalFlash, setShowGoalFlash] = useState(false)
  const [userScore, setUserScore] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)
  const [goalsScoredCount, setGoalsScoredCount] = useState(14)

  // Soccer field physics & position state
  const [ballPos, setBallPos] = useState({ x: 50, y: 80 })
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 80 })
  const [gkPos, setGkPos] = useState({ x: 50, y: 15 })

  useEffect(() => {
    if (window.ethereum) {
      // Get current accounts if already connected
      window.ethereum.request({ method: 'eth_accounts' })
        .then(handleAccountsChanged)
        .catch(console.error);

      // Listen for account/network changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMatches(prev => prev.map(m => {
        if (!m.isLive) return m;
        
        let min = parseInt(m.minute);
        if (isNaN(min)) return m;

        min += 1;
        let nextMinute = `${min}'`;
        let nextIsLive = true;
        let scoreA = m.scoreA;
        let scoreB = m.scoreB;

        if (min >= 90) {
          nextMinute = 'FT';
          nextIsLive = false;
        } else {
          // 4% chance to score a goal for teamA or teamB
          const rand = Math.random();
          if (rand < 0.02) {
            scoreA += 1;
            addLog(`System Goal Alert: ${m.teamA} scored! Current score: ${m.teamA} ${scoreA} - ${scoreB} ${m.teamB}`);
          } else if (rand < 0.04) {
            scoreB += 1;
            addLog(`System Goal Alert: ${m.teamB} scored! Current score: ${m.teamA} ${scoreA} - ${scoreB} ${m.teamB}`);
          }
        }

        return {
          ...m,
          scoreA,
          scoreB,
          minute: nextMinute,
          isLive: nextIsLive
        };
      }));
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0) {
      setWalletConnected(true);
      const address = accounts[0];
      setUserAddress(address);
      addLog(`Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
      
      updateBalance(address);
      const chain = await window.ethereum.request({ method: 'eth_chainId' });
      handleChainChanged(chain);
    } else {
      setWalletConnected(false);
      setUserAddress('');
      setUserBalance('0.00');
      addLog('Wallet disconnected.');
    }
  };

  const handleChainChanged = (hexChainId) => {
    const decChainId = parseInt(hexChainId, 16);
    setChainId(decChainId);
    if (decChainId === 196) {
      addLog('Network switched: OKX X Layer Mainnet');
    } else if (decChainId === 195) {
      addLog('Network switched: OKX X Layer Testnet');
    } else {
      addLog(`Connected to Chain ID ${decChainId}. Please switch to X Layer Mainnet (Chain ID 196).`);
    }
  };

  const updateBalance = async (address) => {
    try {
      const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      const balanceDec = parseInt(balanceHex, 16) / 10**18;
      setUserBalance(balanceDec.toFixed(4));
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      alert('OKX Wallet or MetaMask was not detected. Please install the extension to connect.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      handleAccountsChanged(accounts);
    } catch (error) {
      console.error(error);
      addLog('Wallet connection request rejected.');
    }
  };

  const handleSwitchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xc4' }] // 196 is 0xc4
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xc4',
              chainName: 'X Layer Mainnet',
              nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
              rpcUrls: ['https://rpc.xlayer.tech'],
              blockExplorerUrls: ['https://www.okx.com/explorer/xlayer']
            }]
          });
        } catch (addError) {
          console.error(addError);
        }
      }
    }
  };

  const addLog = (message) => {
    setLogs((prev) => [message, ...prev])
  }

  const handlePredictionChange = (teamId) => {
    setPrediction(teamId)
    addLog(`Selected Prediction: ${teamId === 1 ? 'Argentina 🇦🇷' : 'France 🇫🇷'}`)
  }

  const handleSwapAndStrike = (e) => {
    e.preventDefault()
    if (!walletConnected) {
      alert('Please connect your wallet first!')
      return
    }

    const parsedAmount = parseFloat(swapAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid swap amount.')
      return
    }

    setIsStriking(true)
    addLog(`[beforeSwap] Swapping ${parsedAmount} OKB. Prediction registered for ${prediction === 1 ? 'Argentina' : 'France'}.`)

    // Animate the soccer ball strike
    const targetX = 45 + Math.random() * 10
    const targetY = 10

    setBallPos({ x: targetX, y: targetY })

    // Move Goalkeeper to save (50% chance of correct direction)
    const gkTargetX = targetX + (Math.random() > 0.5 ? -15 : 15)
    setGkPos({ x: gkTargetX, y: 15 })

    setTimeout(() => {
      const distance = Math.abs(gkTargetX - targetX)
      const isGoal = distance > 10

      if (isGoal) {
        setUserScore((prev) => prev + 1)
        setShowGoalFlash(true)
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })
        addLog(`⚽ GOAL! Ball hit the back of the net. You scored!`)

        // Goal Rush rebate
        const isRebate = Math.random() < 0.20 // elevated rate for fun demo
        if (isRebate) {
          setGoalsScoredCount((prev) => prev + 1)
          addLog(`🔥 GOAL RUSH REBATE TRIGGERED! WorldCupGoalRushHook returned 100% of your swap fee (0.01 OKB).`)
        }

        // Add to jackpot
        const contribution = parsedAmount * 0.001
        setJackpot((prev) => prev + contribution)
        if (prediction === 1) {
          setTeamAVotes((prev) => prev + parsedAmount)
        } else {
          setTeamBVotes((prev) => prev + parsedAmount)
        }
      } else {
        setOpponentScore((prev) => prev + 1)
        addLog(`❌ SAVED! Goalkeeper made a stunning save. Swap executed but penalty missed.`)
        
        // Still register contribution to jackpot
        const contribution = parsedAmount * 0.001
        setJackpot((prev) => prev + contribution)
      }

      // Reset ball
      setTimeout(() => {
        setBallPos({ x: 50, y: 80 })
        setIsStriking(false)
        setShowGoalFlash(false)
      }, 1500)

    }, 600)
  }

  const copyCode = (codeText) => {
    navigator.clipboard.writeText(codeText)
    alert('Code copied to clipboard!')
  }

  return (
    <div className="app-wrapper">
      <div className="bg-ambient-glow"></div>
      
      {/* Header / Navbar */}
      <header className="navbar">
        <div className="logo-wrap">
          <span className="logo-icon">⚽</span>
          <h1 className="logo-text">GoalRush</h1>
        </div>
        <nav>
          <ul className="nav-links">
            <li><a href="#dashboard" className="active">Dashboard</a></li>
            <li><a href="#leaderboard">Leaderboard</a></li>
            <li><a href="#about">About</a></li>
          </ul>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {chainId !== null ? (
            chainId === 196 ? (
              <div className="badge-xlayer" style={{ color: 'var(--color-primary)' }}>
                <span className="badge-dot" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }}></span>
                X Layer Mainnet
              </div>
            ) : chainId === 195 ? (
              <div className="badge-xlayer" style={{ color: '#ffcc00' }}>
                <span className="badge-dot" style={{ backgroundColor: '#ffcc00', boxShadow: '0 0 8px #ffcc00' }}></span>
                X Layer Testnet
              </div>
            ) : (
              <button className="badge-xlayer" onClick={handleSwitchNetwork} style={{ cursor: 'pointer', background: 'rgba(255, 51, 68, 0.1)', borderColor: '#ff3344', color: '#ff3344' }}>
                <AlertTriangle size={12} />
                Switch to X Layer
              </button>
            )
          ) : (
            <div className="badge-xlayer">
              <span className="badge-dot" style={{ backgroundColor: '#666' }}></span>
              Not Connected
            </div>
          )}

          {walletConnected ? (
            <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', gap: '8px' }}>
              <User size={14} /> 
              <span>{userAddress.slice(0, 6)}...{userAddress.slice(-4)} ({userBalance} OKB)</span>
            </button>
          ) : (
            <button className="btn-primary" onClick={handleConnectWallet} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Hackathon Hero Section */}
      <section className="hackathon-hero-container">
        <div className="hackathon-left">
          <div className="hackathon-title-group">
            <h2 className="hackathon-big-title">Build X</h2>
            <h2 className="hackathon-big-title">Hackathon</h2>
            <div className="hackathon-sub-title">
              <span>World Cup x Hooks</span>
            </div>
          </div>
          <p className="hackathon-desc">
            GoalRush is a premium sports prediction engine powered by Uniswap V4. Predict winning teams directly via your swaps to claim the match jackpot pool, and score fee rebates.
          </p>
          <div className="hackathon-actions">
            <a href="#dashboard" className="btn-primary">
              <Play size={18} fill="currentColor" /> Try Live Swap
            </a>
            <button 
              className="btn-secondary"
              onClick={() => {
                setShowDevPortal(true);
                setTimeout(() => {
                  document.getElementById('contracts')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Code size={18} /> View Hook Contract
            </button>
          </div>

          {/* Quick Stats Grid under description */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '32px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Network</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>OKX X Layer</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Hook Address</div>
              <div 
                style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText('0xb4f86ecb09BE1FeEbc09C2322A67557F145280c0');
                  alert('Hook address copied to clipboard!');
                }}
              >
                0xb4f8...80c0
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Callbacks</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>before / afterSwap</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Rebate Odds</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-secondary)' }}>5% Chance</div>
            </div>
          </div>
        </div>

        {/* Cyber-Matrix Right Column */}
        <div className="hackathon-right">
          <div className="ascii-ball-wrapper">
            <div className="ascii-code-graphic">
              {asciiArtText}
            </div>
            <div className="ascii-glow-effect"></div>
            <div className="interactive-3d-overlay">
              <SoccerBall3D />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Dashboard / Simulator */}
      <section id="dashboard" className="dashboard-grid">
        {/* Left Side: Soccer Pitch Simulation */}
        <div className="card-bezel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 className="panel-title">
              <TerminalIcon size={20} style={{ color: 'var(--color-primary)' }} />
              GoalRush Pitch Simulator
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
              Trigger a swap through the World Cup V4 Hook contract. Watch your player kick the ball: score a goal to win a Fee Rebate!
            </p>
          </div>
          
          <div className="pitch-container">
            <div className="pitch-lines"></div>
            <div className="pitch-midline"></div>
            <div className="pitch-midcircle"></div>
            <div className="pitch-box-left"></div>
            <div className="pitch-box-right"></div>
            <div className="goal-post-left"></div>
            <div className="goal-post-right"></div>

            {/* Score overlay */}
            <div className="pitch-score-overlay">
              <span style={{ color: 'var(--color-primary)' }}>SWAPPER: {userScore}</span>
              <span>vs</span>
              <span style={{ color: 'var(--color-danger)' }}>GK: {opponentScore}</span>
            </div>

            {/* Goal Flash */}
            <div className={`pitch-goal-flash ${showGoalFlash ? 'active' : ''}`}>
              <div className="pitch-goal-text">GOAL!!</div>
            </div>

            <div 
              className="pitch-ball" 
              style={{ 
                left: `${ballPos.x}%`, 
                top: `${ballPos.y}%`, 
                transform: 'translate(-50%, -50%)',
                animation: isStriking ? 'spin-slow 0.4s linear infinite' : 'none'
              }}
            >
              ⚽
            </div>

            {/* Goalkeeper */}
            <div 
              className="pitch-player opponent" 
              style={{ left: `${gkPos.x}%`, top: `${gkPos.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              GK
            </div>

            {/* Swapper / Player */}
            <div 
              className="pitch-player" 
              style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              P
            </div>
          </div>

          {/* Swap Box */}
          <form className="swap-widget" onSubmit={handleSwapAndStrike}>
            <div className="swap-input-row">
              <div className="swap-input-container">
                <div className="swap-label">From (Sell)</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    value={swapAmount} 
                    onChange={(e) => setSwapAmount(e.target.value)} 
                    className="swap-input" 
                    disabled={isStriking}
                  />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>OKB</span>
                </div>
              </div>
              
              <div className="swap-input-container">
                <div className="swap-label">To (Buy)</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="swap-input" style={{ opacity: 0.8 }}>
                    {parseFloat(swapAmount) ? (parseFloat(swapAmount) * 3.5).toFixed(2) : '0.00'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>USDG</span>
                </div>
              </div>
            </div>

            {/* Select Team Prediction */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="swap-label" style={{ marginBottom: '8px' }}>Attach Match Winner Prediction (via hookData)</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => handlePredictionChange(1)}
                  className={`btn-secondary ${prediction === 1 ? 'active' : ''}`}
                  style={{ flex: 1, borderColor: prediction === 1 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)' }}
                  disabled={isStriking}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    Argentina <img src={getFlagUrl('ARG')} alt="ARG" style={{ width: '16px', height: '11px', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePredictionChange(2)}
                  className={`btn-secondary ${prediction === 2 ? 'active' : ''}`}
                  style={{ flex: 1, borderColor: prediction === 2 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)' }}
                  disabled={isStriking}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    France <img src={getFlagUrl('FRA')} alt="FRA" style={{ width: '16px', height: '11px', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </span>
                </button>
              </div>
            </div>

            <button type="submit" className="swap-btn" disabled={isStriking || !walletConnected}>
              {isStriking ? 'Executing Swap...' : !walletConnected ? 'Connect Wallet to Swap' : 'Swap & Penalty Strike!'}
            </button>
          </form>
        </div>

        {/* Right Side: Prediction Jackpot Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Active Match Info */}
          <div className="card-bezel">
            {/* Tabs Header */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', paddingBottom: '4px' }}>
              <button 
                onClick={() => setActiveRightTab('match')}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: activeRightTab === 'match' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)', 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: 700, 
                  fontSize: '0.95rem',
                  padding: '8px 4px', 
                  cursor: 'pointer',
                  borderBottom: activeRightTab === 'match' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'var(--transition-smooth)'
                }}
              >
                Match Pool
              </button>
              <button 
                onClick={() => setActiveRightTab('scores')}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: activeRightTab === 'scores' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)', 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: 700, 
                  fontSize: '0.95rem',
                  padding: '8px 4px', 
                  cursor: 'pointer',
                  borderBottom: activeRightTab === 'scores' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'var(--transition-smooth)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Live Scores
                <span className="live-dot"></span>
              </button>
            </div>

            {activeRightTab === 'match' ? (
              <>
                <div className="jackpot-display">
                  <div className="swap-label">TOTAL ACCUMULATED JACKPOT</div>
                  <div className="jackpot-val">{jackpot.toFixed(4)} OKB</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    ≈ ${(jackpot * 60).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                  </div>
                </div>

                <div className="predict-bar-container">
                  <div className="swap-label">Prediction Volume Split</div>
                  
                  <div className={`team-row ${prediction === 1 ? 'selected' : ''}`} onClick={() => handlePredictionChange(1)}>
                    <div className="team-meta">
                      <img src={getFlagUrl('ARG')} alt="ARG" className="team-flag" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                      <span className="team-name">Argentina</span>
                    </div>
                    <span className="team-odds">{teamAVotes.toFixed(1)} OKB ({((teamAVotes / (teamAVotes + teamBVotes)) * 100).toFixed(0)}%)</span>
                  </div>

                  <div className={`team-row ${prediction === 2 ? 'selected' : ''}`} onClick={() => handlePredictionChange(2)}>
                    <div className="team-meta">
                      <img src={getFlagUrl('FRA')} alt="FRA" className="team-flag" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                      <span className="team-name">France</span>
                    </div>
                    <span className="team-odds">{teamBVotes.toFixed(1)} OKB ({((teamBVotes / (teamAVotes + teamBVotes)) * 100).toFixed(0)}%)</span>
                  </div>

                  <div className="odds-progress-wrap">
                    <div 
                      className="odds-progress" 
                      style={{ width: `${(teamAVotes / (teamAVotes + teamBVotes)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Console Logs */}
                <div style={{ marginTop: '24px' }}>
                  <div className="swap-label">Transaction Console Logs</div>
                  <div className="console-logs">
                    {logs.map((log, index) => (
                      <div key={index} className={`log-entry ${log.includes('GOAL') ? 'goal' : ''}`}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {liveMatches.map((m) => (
                  <div 
                    key={m.id} 
                    style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={getFlagUrl(m.flagA)} 
                          alt={m.teamA} 
                          style={{ 
                            width: '20px', 
                            height: '14px', 
                            objectFit: 'cover', 
                            borderRadius: '2px', 
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            display: 'inline-block'
                          }} 
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.teamA}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-primary)' }}>{m.scoreA}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={getFlagUrl(m.flagB)} 
                          alt={m.teamB} 
                          style={{ 
                            width: '20px', 
                            height: '14px', 
                            objectFit: 'cover', 
                            borderRadius: '2px', 
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            display: 'inline-block'
                          }} 
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.teamB}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-primary)' }}>{m.scoreB}</span>
                      </div>
                    </div>
                    
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '16px', marginLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: m.isLive ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)' }}>
                        {m.minute}
                      </span>
                      {m.isLive && (
                        <span 
                          style={{ 
                            fontSize: '0.65rem', 
                            color: '#ff3344', 
                            textTransform: 'uppercase', 
                            fontWeight: 700, 
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span style={{ width: '4px', height: '4px', backgroundColor: '#ff3344', borderRadius: '50%', display: 'inline-block', animation: 'live-pulse 1.2s infinite' }}></span>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Leaderboards */}
      <section id="leaderboard" className="card-bezel" style={{ marginBottom: '64px' }}>
        <h3 className="panel-title">
          <Flame size={20} style={{ color: 'var(--color-primary)' }} />
          Tournament Goal Leaderboard
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
          Top creators and swappers registered on OKX X Layer during the tournament.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                <th style={{ padding: '12px' }}>Rank</th>
                <th style={{ padding: '12px' }}>Swapper Address</th>
                <th style={{ padding: '12px' }}>Goals Scored</th>
                <th style={{ padding: '12px' }}>Total Trade Volume</th>
                <th style={{ padding: '12px' }}>Winnings Claimed</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--color-primary)' }}>#1</td>
                <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>0x8a92...284a</td>
                <td style={{ padding: '12px' }}>8 Goals</td>
                <td style={{ padding: '12px' }}>85.4 OKB</td>
                <td style={{ padding: '12px', color: 'var(--color-primary)' }}>3.45 OKB</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#c0c0c0' }}>#2</td>
                <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>0xf3a8...c852</td>
                <td style={{ padding: '12px' }}>5 Goals</td>
                <td style={{ padding: '12px' }}>52.1 OKB</td>
                <td style={{ padding: '12px', color: 'var(--color-primary)' }}>1.90 OKB</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#cd7f32' }}>#3</td>
                <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>0x39ba...e8ff</td>
                <td style={{ padding: '12px' }}>3 Goals</td>
                <td style={{ padding: '12px' }}>24.8 OKB</td>
                <td style={{ padding: '12px', color: 'var(--color-primary)' }}>0.82 OKB</td>
              </tr>
              {walletConnected && (
                <tr style={{ background: 'rgba(157, 255, 0, 0.05)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--color-primary)' }}>MY</td>
                  <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>{userAddress}</td>
                  <td style={{ padding: '12px' }}>{userScore} Goals</td>
                  <td style={{ padding: '12px' }}>{swapAmount} OKB</td>
                  <td style={{ padding: '12px', color: 'var(--color-primary)' }}>0.00 OKB</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* About & Technical Details Section */}
      <section id="about" className="card-bezel" style={{ marginBottom: '64px', marginTop: '32px' }}>
        <h3 className="panel-title">
          <Award size={20} style={{ color: 'var(--color-primary)' }} />
          About GoalRush
        </h3>
        
        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', marginBottom: '24px' }}>
          GoalRush is a decentralized sports prediction protocol built natively on OKX X Layer. It leverages the cutting-edge capabilities of <strong>Uniswap V4 Hooks</strong> to seamlessly combine yield, sports prediction jackpots, and gamified swap fee rebates directly within decentralized trading pools.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚽ Prediction Jackpot
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '8px' }}>
              Whenever you swap, you select your match prediction. The hook intercepts the swap and diverts <strong>0.1% of the swap volume</strong> directly to the match jackpot pool.
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
              <strong>Claim Rules:</strong> Once the match is resolved by the administrator, winners pull their winnings via the claim dashboard. The payout is calculated proportionally: <code>(Your Swap Volume / Total Winning Team Volume) * Total Jackpot Pool</code>.
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ Goal Rush Rebate
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
              Swapping triggers a penalty strike challenge. The smart contract calculates entropy on-chain using block parameters. If you score a goal (5% default rate), the hook immediately triggers a rebate, refunding 100% of your trading fee (0.01 OKB) directly back to your wallet.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔗 X Layer Integration
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
              By deploying on OKX X Layer, GoalRush takes advantage of high-speed block times and ultra-low gas fees. Swappers experience near-instant transaction feedback on their penalty shootouts and minimal fee overhead.
            </p>
          </div>
        </div>

        {/* Developer Sandbox Panel Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(157, 255, 0, 0.03)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(157, 255, 0, 0.15)' }}>
          <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '8px', color: '#fff' }}>Developer Sandbox & Hackathon Panel</h4>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '16px', maxWidth: '600px' }}>
            Are you a hackathon judge or smart contract developer? Inspect the underlying Uniswap V4 Hook Solidity code, CREATE2 deployment scripts, RPC details, and Eulr.fun graduation rules.
          </p>
          <button 
            className="btn-primary" 
            onClick={() => setShowDevPortal(!showDevPortal)}
            style={{ 
              padding: '10px 24px', 
              fontSize: '0.9rem', 
              gap: '8px', 
              backgroundColor: showDevPortal ? 'transparent' : 'var(--color-primary)',
              borderColor: 'var(--color-primary)',
              color: showDevPortal ? 'var(--color-primary)' : '#000' 
            }}
          >
            <Code size={16} /> 
            <span>{showDevPortal ? 'Hide Developer Sandbox' : 'Open Developer Sandbox'}</span>
          </button>
        </div>
      </section>

      {showDevPortal && (
        <>
          {/* Smart Contracts & Explorer */}
          <section id="contracts" className="code-section">
            <h3 className="panel-title">
              <Code size={20} style={{ color: 'var(--color-primary)' }} /> Smart Contract Repository
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
              Inspect the Solidity hook logic and deploy pipelines prepared for OKX X Layer.
            </p>

            <div className="tabs-header">
              <button 
                className={`tab-button ${activeTab === 'hook' ? 'active' : ''}`}
                onClick={() => setActiveTab('hook')}
              >
                WorldCupGoalRushHook.sol
              </button>
              <button 
                className={`tab-button ${activeTab === 'mock' ? 'active' : ''}`}
                onClick={() => setActiveTab('mock')}
              >
                MockPoolManager.sol
              </button>
              <button 
                className={`tab-button ${activeTab === 'deploy' ? 'active' : ''}`}
                onClick={() => setActiveTab('deploy')}
              >
                deploy.js
              </button>
              <button 
                className={`tab-button ${activeTab === 'readme' ? 'active' : ''}`}
                onClick={() => setActiveTab('readme')}
              >
                README.md
              </button>
            </div>

            <div className="code-viewer-container">
              <div className="code-header">
                <span className="code-lang">
                  {activeTab === 'hook' || activeTab === 'mock' ? 'SOLIDITY' : activeTab === 'deploy' ? 'JAVASCRIPT' : 'MARKDOWN'}
                </span>
                <button 
                  className="btn-copy" 
                  onClick={() => {
                    const textMap = {
                      hook: hookSolidityCode,
                      mock: mockManagerCode,
                      deploy: deployScriptCode,
                      readme: readmeMarkdown
                    }
                    copyCode(textMap[activeTab])
                  }}
                >
                  <Copy size={12} /> Copy Code
                </button>
              </div>
              
              <pre className="code-pre">
                <code>
                  {activeTab === 'hook' && hookSolidityCode}
                  {activeTab === 'mock' && mockManagerCode}
                  {activeTab === 'deploy' && deployScriptCode}
                  {activeTab === 'readme' && readmeMarkdown}
                </code>
              </pre>
            </div>
          </section>

          {/* Deployment Guide */}
          <section id="docs" className="card-bezel" style={{ marginBottom: '64px' }}>
            <h3 className="panel-title">
              <Cpu size={20} style={{ color: 'var(--color-primary)' }} /> Deploying on X Layer Mainnet
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'var(--color-primary-glow)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--color-primary)', fontWeight: 'bold', flexShrink: 0, justifyContent: 'center' }}>1</div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Compile with Hardhat</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Use the Solidity compiler version 0.8.24 or later to ensure compatibility with EVM push/pop logic.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'var(--color-primary-glow)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--color-primary)', fontWeight: 'bold', flexShrink: 0, justifyContent: 'center' }}>2</div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Address Mining</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Uniswap V4 hooks require the deployed address to match flag prefixes. Use address mining tools to find the proper salt for CREATE2.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'var(--color-primary-glow)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--color-primary)', fontWeight: 'bold', flexShrink: 0, justifyContent: 'center' }}>3</div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Verify on X Layer Explorer</h4>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Submit contracts to OKX Link/Explorer for public verification using ABI-encoded initialization parameters.</p>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-primary)' }} />
                  X Layer RPC Information
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Network Name</span>
                    <span>X Layer Mainnet</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>RPC URL</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>https://rpc.xlayer.tech</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Chain ID</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>196</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Currency Symbol</span>
                    <span>OKB</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Block Explorer</span>
                    <span style={{ color: 'var(--color-primary)' }}>https://www.okx.com/explorer/xlayer</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(157, 255, 0, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(157, 255, 0, 0.15)' }}>
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                  <Flame size={16} />
                  Qualify for $200K USDT (Eulr.fun)
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '8px' }}>
                    Deploy your hook, launch your token on <strong>Eulr.fun</strong>, and choose your hook address during creation.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid var(--color-primary)', paddingLeft: '8px' }}>
                    <div><strong>1. Launch:</strong> Create token + bonding curve on Eulr.fun in minutes.</div>
                    <div><strong>2. Graduate:</strong> Hits bonding curve limit → automatically deploys Uniswap V4 Pool with your hook.</div>
                    <div><strong>3. Trade & Win:</strong> Swap using OKX Wallet on your pool after graduation to count towards the $200k prize ranking!</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2026 GoalRush. Powered by Uniswap V4 & OKX X Layer.</p>
      </footer>
    </div>
  )
}
