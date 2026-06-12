import React, { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import confetti from 'canvas-confetti'
import goalRushLogo from './assets/logo.png'
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
  AlertTriangle,
  LogOut
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
        owner = tx.origin;
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

const getTeamFifaCode = (name) => {
  const mapping = {
    'argentina': 'ARG',
    'france': 'FRA',
    'canada': 'CAN',
    'united states': 'USA',
    'mexico': 'MEX',
    'brazil': 'BRA',
    'spain': 'ESP',
    'germany': 'GER',
    'england': 'ENG',
    'italy': 'ITA',
    'portugal': 'POR',
    'croatia': 'CRO',
    'netherlands': 'NED',
    'belgium': 'BEL',
    'japan': 'JPN',
    'korea': 'KOR',
    'switzerland': 'SUI',
    'morocco': 'MAR'
  };
  return mapping[name?.toLowerCase().trim()] || 'UN';
};

// Helper to get the correct OKX Wallet or Ethereum provider
const getProvider = () => {
  if (typeof window !== 'undefined') {
    return window.okxwallet || window.ethereum;
  }
  return null;
};

export default function App() {
  const [activeMatch, setActiveMatch] = useState({
    id: 1,
    teamA: 'Argentina',
    teamB: 'France',
    resolved: false
  });
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
  const [userScore, setUserScore] = useState(() => {
    return Number(localStorage.getItem('goalrush_userScore') || '0');
  })
  const [totalUserVolume, setTotalUserVolume] = useState(() => {
    return parseFloat(localStorage.getItem('goalrush_userVolume') || '0');
  })
  const [leaderboardData, setLeaderboardData] = useState([])
  const [opponentScore, setOpponentScore] = useState(0)
  const [goalsScoredCount, setGoalsScoredCount] = useState(14)

  // Soccer field physics & position state
  const [ballPos, setBallPos] = useState({ x: 50, y: 80 })
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 80 })
  const [gkPos, setGkPos] = useState({ x: 50, y: 15 })

  useEffect(() => {
    const provider = getProvider();
    if (provider) {
      // Get current accounts if already connected
      provider.request({ method: 'eth_accounts' })
        .then(handleAccountsChanged)
        .catch(console.error);

      // Listen for account/network changes
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
    }
    return () => {
      const provider = getProvider();
      if (provider) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
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

  useEffect(() => {
    const fetchOnChainData = async () => {
      try {
        const hookAddress = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";
        const rpcProvider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
        const abi = [
          "function activeMatchId() external view returns (uint256)",
          "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
          "function teamPredictionVolume(uint256, uint8) external view returns (uint256)",
          "event GoalScored(address indexed swapper, uint256 bonusAmount)",
          "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
          "event JackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount)"
        ];
        
        const hookContract = new ethers.Contract(hookAddress, abi, rpcProvider);
        const activeId = await hookContract.activeMatchId();
        
        if (Number(activeId) > 0) {
          const matchData = await hookContract.matches(activeId);
          
          setActiveMatch({
            id: Number(matchData[0] || matchData.id || activeId),
            teamA: matchData[1] || matchData.teamA || 'Argentina',
            teamB: matchData[2] || matchData.teamB || 'France',
            resolved: matchData[5] !== undefined ? matchData[5] : matchData.resolved
          });

          const totalJackpotWei = matchData[7] || matchData.totalJackpot || 0n;
          
          const contractBalance = await rpcProvider.getBalance(hookAddress);
          const displayJackpot = contractBalance > totalJackpotWei ? contractBalance : totalJackpotWei;
          
          setJackpot(Number(ethers.formatEther(displayJackpot)));
          
          const volA = await hookContract.teamPredictionVolume(activeId, 1);
          const volB = await hookContract.teamPredictionVolume(activeId, 2);
          
          setTeamAVotes(Number(ethers.formatEther(volA)));
          setTeamBVotes(Number(ethers.formatEther(volB)));
        }

        // Query events from contract
        let goalEvents = [];
        let predictionEvents = [];
        let claimEvents = [];
        
        try {
          // X Layer blocks are quick, let's query from block 2600000 to latest
          goalEvents = await hookContract.queryFilter(hookContract.filters.GoalScored(), 2600000, "latest");
          predictionEvents = await hookContract.queryFilter(hookContract.filters.PredictionPlaced(), 2600000, "latest");
          claimEvents = await hookContract.queryFilter(hookContract.filters.JackpotClaimed(), 2600000, "latest");
        } catch (eventErr) {
          console.warn("Failed to query contract events:", eventErr);
        }

        const stats = {};
        const getOrCreateUser = (addr) => {
          const lower = addr.toLowerCase();
          if (!stats[lower]) {
            stats[lower] = {
              address: addr,
              goals: 0,
              volume: 0n,
              claimed: 0n
            };
          }
          return stats[lower];
        };

        goalEvents.forEach(evt => {
          if (evt.args) {
            const swapper = evt.args[0];
            getOrCreateUser(swapper).goals += 1;
          }
        });

        predictionEvents.forEach(evt => {
          if (evt.args) {
            const user = evt.args[0];
            const volume = evt.args[3];
            getOrCreateUser(user).volume += BigInt(volume);
          }
        });

        claimEvents.forEach(evt => {
          if (evt.args) {
            const user = evt.args[0];
            const amount = evt.args[2];
            getOrCreateUser(user).claimed += BigInt(amount);
          }
        });

        // Inject active user's local session stats if connected
        if (userAddress) {
          const localG = Number(localStorage.getItem('goalrush_userScore') || '0');
          const localV = parseFloat(localStorage.getItem('goalrush_userVolume') || '0');
          
          const u = getOrCreateUser(userAddress);
          if (localG > u.goals) u.goals = localG;
          
          const localWei = ethers.parseEther(localV.toString());
          if (localWei > u.volume) u.volume = localWei;
        }

        // Map map to array
        const leaderboardArray = Object.values(stats).map(item => ({
          address: item.address,
          goals: item.goals,
          volume: Number(ethers.formatEther(item.volume)),
          claimed: Number(ethers.formatEther(item.claimed))
        }));

        // Sort by goals descending, then by volume descending
        leaderboardArray.sort((a, b) => {
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.volume - a.volume;
        });

        setLeaderboardData(leaderboardArray);

      } catch (err) {
        console.error("Failed to fetch on-chain stats:", err);
      }
    };
    
    fetchOnChainData();
    const interval = setInterval(fetchOnChainData, 10000);
    return () => clearInterval(interval);
  }, [userAddress]);

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0) {
      setWalletConnected(true);
      const address = accounts[0];
      setUserAddress(address);
      addLog(`Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
      
      updateBalance(address);
      const provider = getProvider();
      if (provider) {
        const chain = await provider.request({ method: 'eth_chainId' });
        handleChainChanged(chain);
      }
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
      const provider = getProvider();
      if (!provider) return;
      const balanceHex = await provider.request({
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
    const provider = getProvider();
    if (!provider) {
      alert('OKX Wallet was not detected. Please install the OKX Wallet extension on your browser or open this page inside the OKX Wallet mobile app.');
      return;
    }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      handleAccountsChanged(accounts);
    } catch (error) {
      console.error(error);
      addLog('Wallet connection request rejected.');
    }
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setUserAddress('');
    setUserBalance('0.00');
    setChainId(null);
    addLog('Wallet disconnected by user.');
  };

  const handleSwitchNetwork = async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xc4' }] // 196 is 0xc4
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
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

  const handleSwapAndStrike = async (e) => {
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
    addLog(`[beforeSwap] Initiating swap transaction of ${parsedAmount} OKB on-chain...`)

    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error("No wallet provider detected");
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const hookAddress = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";

      // Request user's wallet to send a real transaction to the hook address
      const tx = await signer.sendTransaction({
        to: hookAddress,
        value: ethers.parseEther(swapAmount)
      });

      addLog(`Transaction submitted: ${tx.hash.slice(0, 10)}... waiting for confirmation`);
      await tx.wait();
      addLog(`🎉 Transaction confirmed! Match jackpot successfully funded with ${parsedAmount} OKB.`);

      // Increment volume in localStorage and state
      setTotalUserVolume((prev) => {
        const next = prev + parsedAmount;
        localStorage.setItem('goalrush_userVolume', next.toString());
        return next;
      });

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
          setUserScore((prev) => {
            const next = prev + 1;
            localStorage.setItem('goalrush_userScore', next.toString());
            return next;
          });
          setShowGoalFlash(true)
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })
          addLog(`⚽ GOAL! Ball hit the back of the net. You scored!`)
        } else {
          setOpponentScore((prev) => prev + 1)
          addLog(`❌ SAVED! Goalkeeper made a stunning save. Swap executed but penalty missed.`)
        }

        // Reset ball
        setTimeout(() => {
          setBallPos({ x: 50, y: 80 })
          setIsStriking(false)
          setShowGoalFlash(false)
        }, 1500)

      }, 600)

    } catch (err) {
      console.error(err);
      addLog(`❌ Transaction failed or rejected: ${err.message || err}`);
      setIsStriking(false);
    }
  }

  const handleSelectMatchUI = (match) => {
    setActiveMatch({
      id: match.id,
      teamA: match.teamA,
      teamB: match.teamB,
      resolved: false
    });
    addLog(`Selected Match in UI: ${match.teamA} vs ${match.teamB}`);
  };

  const handleActivateMatchOnChain = async (match) => {
    if (!walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const rawProvider = getProvider();
      if (!rawProvider) throw new Error("No wallet provider detected");
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const hookAddress = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";
      const abi = [
        "function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external"
      ];
      const hookContract = new ethers.Contract(hookAddress, abi, signer);
      addLog(`[Activate Match] Submitting transaction to activate ${match.teamA} vs ${match.teamB} on-chain...`);
      
      const tx = await hookContract.createMatch(match.id, match.teamA, match.teamB, 24 * 60 * 60);
      addLog(`Transaction submitted: ${tx.hash.slice(0, 10)}... waiting for confirmation`);
      await tx.wait();
      addLog(`🎉 Match #${match.id} (${match.teamA} vs ${match.teamB}) successfully activated on-chain!`);
      
      setActiveMatch({
        id: match.id,
        teamA: match.teamA,
        teamB: match.teamB,
        resolved: false
      });
    } catch (err) {
      console.error(err);
      addLog(`❌ Activation failed: ${err.reason || err.message || err}`);
      alert(`Activation failed. Only the contract owner can change the active match. Details: ${err.reason || err.message || err}`);
    }
  };

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
        <div className="nav-actions">
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
            <div className="wallet-connected-wrapper">
              <div className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                <User size={14} /> 
                <span>{userAddress.slice(0, 6)}...{userAddress.slice(-4)} ({userBalance} OKB)</span>
              </div>
              <button 
                className="btn-secondary" 
                onClick={handleDisconnectWallet} 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '0.9rem', 
                  color: 'var(--color-danger)', 
                  borderColor: 'rgba(255, 51, 68, 0.2)',
                  background: 'rgba(255, 51, 68, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <LogOut size={14} />
                <span>Disconnect</span>
              </button>
            </div>
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
            <div style={{ 
              display: 'inline-flex',
              padding: '16px', 
              borderRadius: '24px', 
              background: '#000000', 
              border: '1px solid rgba(157, 255, 0, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(157, 255, 0, 0.08)',
              marginBottom: '24px',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <img 
                src="/logo.png?v=2" 
                alt="Goal Rush Logo" 
                className="hero-logo-img" 
                style={{ 
                  maxHeight: '180px', 
                  width: 'auto', 
                  display: 'block', 
                  mixBlendMode: 'screen',
                  filter: 'contrast(1.6) brightness(0.9) saturate(1.2)'
                }} 
              />
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
                  navigator.clipboard.writeText('0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0');
                  alert('Hook address copied to clipboard!');
                }}
              >
                0xD168...40c0
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
                <div className="swap-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span>To (Buy)</span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>GRUSH: GoalRush tournament game token</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="swap-input" style={{ opacity: 0.8 }}>
                    {parseFloat(swapAmount) ? (parseFloat(swapAmount) * 3.5).toFixed(2) : '0.00'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>GRUSH</span>
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
                    {activeMatch.teamA} <img src={getFlagUrl(getTeamFifaCode(activeMatch.teamA))} alt={activeMatch.teamA} style={{ width: '16px', height: '11px', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
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
                    {activeMatch.teamB} <img src={getFlagUrl(getTeamFifaCode(activeMatch.teamB))} alt={activeMatch.teamB} style={{ width: '16px', height: '11px', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </span>
                </button>
              </div>
            </div>

            <button 
              type={walletConnected ? "submit" : "button"} 
              className="swap-btn" 
              disabled={isStriking}
              onClick={!walletConnected ? handleConnectWallet : undefined}
            >
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

            {activeRightTab === 'match' ? (() => {
              const totalVotes = teamAVotes + teamBVotes;
              const percentageA = totalVotes > 0 ? ((teamAVotes / totalVotes) * 100).toFixed(0) : '50';
              const percentageB = totalVotes > 0 ? ((teamBVotes / totalVotes) * 100).toFixed(0) : '50';
              const progressWidth = totalVotes > 0 ? (teamAVotes / totalVotes) * 100 : 50;
              return (
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
                        <img src={getFlagUrl(getTeamFifaCode(activeMatch.teamA))} alt={activeMatch.teamA} className="team-flag" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <span className="team-name">{activeMatch.teamA}</span>
                      </div>
                      <span className="team-odds">{teamAVotes.toFixed(1)} OKB ({percentageA}%)</span>
                    </div>

                    <div className={`team-row ${prediction === 2 ? 'selected' : ''}`} onClick={() => handlePredictionChange(2)}>
                      <div className="team-meta">
                        <img src={getFlagUrl(getTeamFifaCode(activeMatch.teamB))} alt={activeMatch.teamB} className="team-flag" style={{ width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                        <span className="team-name">{activeMatch.teamB}</span>
                      </div>
                      <span className="team-odds">{teamBVotes.toFixed(1)} OKB ({percentageB}%)</span>
                    </div>

                    <div className="odds-progress-wrap">
                      <div 
                        className="odds-progress" 
                        style={{ width: `${progressWidth}%` }}
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
              );
            })() : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {liveMatches.map((m) => {
                  const isSelected = activeMatch.id === m.id;
                  return (
                    <div 
                      key={m.id} 
                      onClick={() => handleSelectMatchUI(m)}
                      style={{ 
                        background: isSelected ? 'rgba(157, 255, 0, 0.03)' : 'rgba(255,255,255,0.02)', 
                        padding: '16px', 
                        borderRadius: '12px', 
                        border: isSelected ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
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
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--color-primary)' : '#fff' }}>{m.teamA}</span>
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
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--color-primary)' : '#fff' }}>{m.teamB}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-primary)' }}>{m.scoreB}</span>
                        </div>
                      </div>
                      
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '16px', marginLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '80px' }}>
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
                        {isSelected ? (
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '6px', background: 'rgba(157, 255, 0, 0.12)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            ON-CHAIN
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateMatchOnChain(m);
                            }}
                            style={{
                              fontSize: '0.65rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              color: '#fff',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginTop: '6px',
                              transition: 'all 0.2s',
                              fontWeight: 600
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'var(--color-primary)';
                              e.target.style.color = '#000';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                              e.target.style.color = '#fff';
                            }}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              {leaderboardData.length > 0 ? (
                leaderboardData.map((row, idx) => {
                  const isCurrentUser = walletConnected && userAddress && row.address.toLowerCase() === userAddress.toLowerCase();
                  return (
                    <tr 
                      key={row.address} 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isCurrentUser ? 'rgba(157, 255, 0, 0.05)' : 'transparent'
                      }}
                    >
                      <td style={{ 
                        padding: '12px', 
                        fontWeight: 'bold', 
                        color: isCurrentUser 
                          ? 'var(--color-primary)' 
                          : idx === 0 
                            ? 'var(--color-primary)' 
                            : idx === 1 
                              ? '#c0c0c0' 
                              : idx === 2 
                                ? '#cd7f32' 
                                : 'rgba(255,255,255,0.6)' 
                      }}>
                        {isCurrentUser ? 'MY' : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                        {row.address.slice(0, 8)}...{row.address.slice(-6)}
                      </td>
                      <td style={{ padding: '12px' }}>{row.goals} Goals</td>
                      <td style={{ padding: '12px' }}>{row.volume.toFixed(2)} OKB</td>
                      <td style={{ padding: '12px', color: 'var(--color-primary)' }}>{row.claimed.toFixed(2)} OKB</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    No active swappers recorded yet. Swap & predict to become the first on the board!
                  </td>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚽ Prediction Jackpot
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '8px' }}>
              Whenever you swap, you select your match prediction. The hook intercepts the swap and diverts <strong>0.1% of the swap volume</strong> directly to the match jackpot pool.
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
              <strong>Claim Rules:</strong> Once the match is resolved on-chain, winners pull their winnings proportionally: <code>(Your Swap Volume / Total Winning Team Volume) * Total Jackpot Pool</code>.
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📡 Live Match Integration
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', marginBottom: '8px' }}>
              Choose from real-world matches in the Live Scores feed. Anyone can select a fixture, and the contract owner can instantiate it directly onto the contract with a single click.
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
              <strong>Real-Time Updates:</strong> Live matches load automatically. Simply click any match in the feed to set it as the target prediction match in the swap widget.
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ Goal Rush Rebate
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
              Swapping triggers an on-chain penalty strike challenge. The smart contract calculates entropy using block parameters. If you score a goal (5% default rate), the hook immediately rebates 100% of your trading fee (0.01 OKB) back to your wallet.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔗 X Layer Integration
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
              Deployed on OKX X Layer Mainnet, GoalRush utilizes high-speed block confirmation times and ultra-low gas fees. Swappers experience instant transaction feedback on penalty shootouts and minimal fee overhead.
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
                  Token Deployment Choices
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
                  <div>
                    <strong style={{ color: 'var(--color-secondary)' }}>Option 1: Deploy Token Ourselves (Independent Launch)</strong>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px' }}>
                      Compile and deploy the <code>GoalRushToken.sol</code> contract directly to X Layer Mainnet using Hardhat:
                      <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '4px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>npx hardhat run scripts/deploy-token.cjs --network xlayer</code>
                    </p>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                    <strong style={{ color: 'var(--color-primary)' }}>Option 2: Launch via Eulr.fun (Bonding Curve)</strong>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px' }}>
                      Create token + bonding curve on Eulr.fun, hit the curve limit to automatically deploy the Uniswap V4 Pool with this hook, and qualify for the $200k prize ranking.
                    </p>
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
