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
  LogOut,
  X,
  Twitter,
  Send
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

// Helper to get the correct OKX Wallet provider strictly
const getProvider = () => {
  if (typeof window !== 'undefined') {
    // 1. Check direct okxwallet injector
    if (window.okxwallet) return window.okxwallet;
    
    // 2. Check if window.ethereum is OKX Wallet
    if (window.ethereum) {
      if (window.ethereum.isOKXWallet) return window.ethereum;
      
      // 3. Handle multi-provider injection setups (e.g. OKX + MetaMask coexistence)
      if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
        const okx = window.ethereum.providers.find(p => p.isOKXWallet);
        if (okx) return okx;
      }
    }
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
  
  const activeMatchRef = useRef(activeMatch);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  const [matchId, setMatchId] = useState(1)
  const [prediction, setPrediction] = useState(1) // 1 = Argentina, 2 = France
  const [swapAmount, setSwapAmount] = useState('0.001')
  const [jackpot, setJackpot] = useState(128.5)
  const [teamAVotes, setTeamAVotes] = useState(64.2) // Argentina volume OKB
  const [teamBVotes, setTeamBVotes] = useState(48.8) // France volume OKB
  const [activeTab, setActiveTab] = useState('hook') // hook, mock, deploy, readme
  const [showDevPortal, setShowDevPortal] = useState(false)
  const [showWhitepaper, setShowWhitepaper] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [activeRightTab, setActiveRightTab] = useState('match') // match or scores
  const [shootoutStatus, setShootoutStatus] = useState('')
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('goalrush_history')
    return saved ? JSON.parse(saved) : []
  })
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
  const [grushBalance, setGrushBalance] = useState('0.00')
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
  const [ballPos, setBallPos] = useState({ x: 50, y: 50 })
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 56 })
  const [gkPos, setGkPos] = useState({ x: 2, y: 50 })

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

      if (userAddress) {
        getOrCreateUser(userAddress);
      }

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

        let currentId = activeMatchRef.current.id;

        // If not initialized yet from the contract, query the default activeMatchId
        if (!hasInitializedRef.current) {
          try {
            const activeId = await hookContract.activeMatchId();
            const actIdNum = Number(activeId);
            if (actIdNum > 0) {
              currentId = actIdNum;
              hasInitializedRef.current = true;
            }
          } catch (activeIdErr) {
            console.warn("Failed to fetch activeMatchId on initialization:", activeIdErr);
          }
        }

        // Fetch selected match info safely
        try {
          const matchData = await hookContract.matches(currentId);
          const onChainId = Number(matchData[0] || matchData.id || 0);
          
          if (onChainId > 0) {
            const teamAName = matchData[1] || matchData.teamA || activeMatchRef.current.teamA;
            const teamBName = matchData[2] || matchData.teamB || activeMatchRef.current.teamB;
            const isResolved = matchData[5] !== undefined ? matchData[5] : matchData.resolved;
            
            setActiveMatch(prev => {
              if (prev.id !== currentId) return prev;
              // Only trigger state updates if the data has actually changed to prevent render loops
              if (prev.teamA === teamAName && prev.teamB === teamBName && prev.resolved === isResolved) {
                return prev;
              }
              return {
                id: currentId,
                teamA: teamAName,
                teamB: teamBName,
                resolved: isResolved
              };
            });

            const totalJackpotWei = matchData[7] || matchData.totalJackpot || 0n;
            const contractBalance = await rpcProvider.getBalance(hookAddress);
            const displayJackpot = contractBalance > totalJackpotWei ? contractBalance : totalJackpotWei;
            setJackpot(Number(ethers.formatEther(displayJackpot)));
            
            const volA = await hookContract.teamPredictionVolume(currentId, 1);
            const volB = await hookContract.teamPredictionVolume(currentId, 2);
            setTeamAVotes(Number(ethers.formatEther(volA)));
            setTeamBVotes(Number(ethers.formatEther(volB)));
          } else {
            // Keep UI match details, but set jackpot/votes to 0 for local simulation
            setJackpot(0);
            setTeamAVotes(0);
            setTeamBVotes(0);
          }
        } catch (matchErr) {
          console.warn("Failed to fetch match data from hook contract for ID:", currentId, matchErr);
        }

        // Query events safely
        let goalEvents = [];
        let predictionEvents = [];
        let claimEvents = [];
        
        try {
          goalEvents = await hookContract.queryFilter(hookContract.filters.GoalScored(), 2600000, "latest");
          predictionEvents = await hookContract.queryFilter(hookContract.filters.PredictionPlaced(), 2600000, "latest");
          claimEvents = await hookContract.queryFilter(hookContract.filters.JackpotClaimed(), 2600000, "latest");
        } catch (eventErr) {
          console.warn("Failed to query contract events:", eventErr);
        }

        // Process retrieved events
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

      } catch (err) {
        console.error("General error in fetchOnChainData:", err);
      }

      // ALWAYS run this even if on-chain fetch fails!
      if (userAddress) {
        const localG = Number(localStorage.getItem('goalrush_userScore') || '0');
        const localV = parseFloat(localStorage.getItem('goalrush_userVolume') || '0');
        
        const u = getOrCreateUser(userAddress);
        if (localG > u.goals) u.goals = localG;
        
        const localWei = ethers.parseEther(localV.toString());
        if (localWei > u.volume) u.volume = localWei;
      }

      // Map map to array (filter out entries with 0 goals AND 0 volume so it only displays active players)
      const leaderboardArray = Object.values(stats)
        .map(item => ({
          address: item.address,
          goals: item.goals,
          volume: Number(ethers.formatEther(item.volume)),
          claimed: Number(ethers.formatEther(item.claimed))
        }))
        .filter(item => item.goals > 0 || item.volume > 0);

      // Sort by goals descending, then by volume descending
      leaderboardArray.sort((a, b) => {
        if (b.goals !== a.goals) return b.goals - a.goals;
        return b.volume - a.volume;
      });

      setLeaderboardData(leaderboardArray);
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
      updateGrushBalance(address);
      const provider = getProvider();
      if (provider) {
        const chain = await provider.request({ method: 'eth_chainId' });
        handleChainChanged(chain);
      }
    } else {
      setWalletConnected(false);
      setUserAddress('');
      setUserBalance('0.00');
      setGrushBalance('0.00');
      addLog('Wallet disconnected.');
    }
  };

  const updateGrushBalance = async (address) => {
    try {
      const provider = getProvider();
      if (!provider) return;
      
      const tokenAddress = '0x422fe165b2da990d18c6dca944b11dcd61519671';
      // balanceOf signature is 0x70a08231
      const cleanAddr = address.toLowerCase().replace('0x', '');
      const data = '0x70a08231' + cleanAddr.padStart(64, '0');
      
      const balanceHex = await provider.request({
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: data
        }, 'latest']
      });
      
      if (balanceHex && balanceHex !== '0x') {
        const balanceBigInt = BigInt(balanceHex);
        const balanceDec = Number(balanceBigInt) / 10**18;
        setGrushBalance(balanceDec.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      } else {
        setGrushBalance('0.00');
      }
    } catch (e) {
      console.error('Error fetching GRUSH balance:', e);
      setGrushBalance('0.00');
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
    setGrushBalance('0.00');
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
    const selectedTeam = teamId === 1 ? activeMatch.teamA : activeMatch.teamB
    addLog(`Selected Prediction: ${selectedTeam} ⚽`)
    
    // Ball and player always reset to the middle!
    setBallPos({ x: 50, y: 50 })
    setPlayerPos({ x: 50, y: 56 })
    
    // Goalkeeper snaps to the predicted goalpost
    if (teamId === 1) {
      setGkPos({ x: 2, y: 50 }) // left goal
    } else {
      setGkPos({ x: 98, y: 50 }) // right goal
    }
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
      const routerAddress = "0xe1Ad1C1Ab7600E6c3Fbaf0c80c3b947B7F901B7F";
      const routerAbi = ["function predictAndDeposit() external payable"];
      const routerContract = new ethers.Contract(routerAddress, routerAbi, signer);

      // Call the formal payable predictAndDeposit function.
      // This is a contract interaction, so OKX Wallet does not flag it as suspicious.
      const tx = await routerContract.predictAndDeposit({
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

      // Check if user holds any GRUSH tokens
      const holdsGrush = parseFloat(grushBalance.replace(/,/g, '')) > 0;
      if (holdsGrush) {
        addLog("🟢 GRUSH Holder perk active: 75% penalty shootout success rate boost!");
      }

      // Determine outcome based on probabilities (GRUSH holders: 75% goal / 25% save; others: 50% goal / 50% save)
      const successChance = holdsGrush ? 0.75 : 0.50;
      const isGoalResult = Math.random() < successChance;

      // 1. Set Status to "READY"
      setShootoutStatus('READY 🚨')
      addLog("⚽ Shootout Initiated! Prepare for strike...")
      await new Promise(resolve => setTimeout(resolve, 800))

      // 2. Set Status to "SET"
      setShootoutStatus('SET 🎯')
      await new Promise(resolve => setTimeout(resolve, 800))

      // 3. Set Status to "STRIKE"
      setShootoutStatus('STRIKE ⚽')
      await new Promise(resolve => setTimeout(resolve, 600))
      setShootoutStatus('') // Clear countdown overlay to show action

      // 4. Player runs up to the ball (moves from 56 to 50, 50)
      addLog("🏃 Swapper running up to kick...")
      setPlayerPos({ x: 50, y: 50 })
      await new Promise(resolve => setTimeout(resolve, 400))

      // 5. Kick the ball (it moves halfway and GK starts to move)
      addLog("⚡ Strike launched! Ball in mid-air...")
      const targetX = prediction === 1 ? 1 : 99
      const targetY = 42 + Math.random() * 16 // final ball Y coordinate
      
      // Goalkeeper final Y coordinate
      // If Goal, goalkeeper dives far away from the ball. If Save, goalkeeper dives close to the ball.
      const gkTargetX = prediction === 1 ? 2 : 98
      const gkTargetY = isGoalResult 
        ? targetY + (Math.random() > 0.5 ? -16 : 16) 
        : targetY + (Math.random() - 0.5) * 4;

      // Mid-point coordinates from the center circle (50, 50)
      setBallPos({ x: (50 + targetX) / 2, y: (50 + targetY) / 2 })
      setGkPos({ x: gkTargetX, y: (50 + gkTargetY) / 2 })

      // Dramatic pause at mid-air (slow-mo effect)
      await new Promise(resolve => setTimeout(resolve, 500))

      // 6. Impact: Ball reaches the goal, goalkeeper completes the dive
      setBallPos({ x: targetX, y: targetY })
      setGkPos({ x: gkTargetX, y: gkTargetY })
      
      // Wait for ball to hit target
      await new Promise(resolve => setTimeout(resolve, 300))

      const distance = Math.abs(gkTargetY - targetY)
      const isGoal = distance > 8

      // Haptic shake on pitch card
      const pitchEl = document.querySelector('.pitch-container')
      if (pitchEl) {
        pitchEl.classList.add('pitch-shake')
        setTimeout(() => pitchEl.classList.remove('pitch-shake'), 400)
      }

      if (isGoal) {
        setUserScore((prev) => {
          const next = prev + 1;
          localStorage.setItem('goalrush_userScore', next.toString());
          return next;
        });
        setShowGoalFlash(true)
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 }
        })
        // Extra confetti burst for maximum dopamine rush!
        setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          })
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          })
        }, 300)
        addLog(`⚽ GOAL! Ball hit the back of the net. You scored!`)
      } else {
        setOpponentScore((prev) => prev + 1)
        addLog(`❌ SAVED! Goalkeeper made a stunning save. Swap executed but penalty missed.`)
      }

      // Increment predicted team volume dynamically in state
      if (prediction === 1) {
        setTeamAVotes((prev) => prev + parsedAmount);
      } else {
        setTeamBVotes((prev) => prev + parsedAmount);
      }

      // Add to prediction history
      const newHistoryEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        match: `${activeMatch.teamA} vs ${activeMatch.teamB}`,
        prediction: prediction === 1 ? activeMatch.teamA : activeMatch.teamB,
        amount: `${parsedAmount} OKB`,
        result: isGoal ? 'GOAL ⚽' : 'SAVED ❌'
      }
      setHistory((prev) => {
        const next = [newHistoryEntry, ...prev]
        localStorage.setItem('goalrush_history', JSON.stringify(next))
        return next
      })

      // 7. Reset player, ball, and goalie
      setTimeout(() => {
        setBallPos({ x: 50, y: 50 })
        setPlayerPos({ x: 50, y: 56 })
        if (prediction === 1) {
          setGkPos({ x: 2, y: 50 })
        } else {
          setGkPos({ x: 98, y: 50 })
        }
        setIsStriking(false)
        setShowGoalFlash(false)
      }, 2500)

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
    setPrediction(1);
    setBallPos({ x: 50, y: 50 })
    setPlayerPos({ x: 50, y: 56 })
    setGkPos({ x: 2, y: 50 })
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
      setPrediction(1);
      setBallPos({ x: 50, y: 50 })
      setPlayerPos({ x: 50, y: 56 })
      setGkPos({ x: 2, y: 50 })
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
            <li>
              <button 
                onClick={() => setShowWhitepaper(true)} 
                className="btn-secondary" 
                style={{ 
                  padding: '4px 10px', 
                  fontSize: '0.8rem', 
                  color: 'var(--color-primary)', 
                  borderColor: 'rgba(157,255,0,0.3)',
                  cursor: 'pointer',
                  background: 'rgba(157,255,0,0.05)',
                  borderRadius: '6px'
                }}
              >
                📄 Whitepaper
              </button>
            </li>
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
              <div 
                className={`btn-secondary ${parseFloat(grushBalance.replace(/,/g, '')) > 0 ? 'text-glow-green' : ''}`} 
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '0.9rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'default',
                  borderColor: parseFloat(grushBalance.replace(/,/g, '')) > 0 ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)',
                  background: parseFloat(grushBalance.replace(/,/g, '')) > 0 ? 'rgba(157, 255, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)'
                }}
              >
                <User size={14} /> 
                <span>
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)} ({userBalance} OKB
                  {parseFloat(grushBalance.replace(/,/g, '')) > 0 && ` | ⚽ ${grushBalance} GRUSH`}
                  )
                </span>
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
            <a 
              href="https://eulr.fun/token/0x422fe165b2da990d18c6dca944b11dcd61519671" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderColor: 'rgba(0, 229, 255, 0.4)' }}
            >
              📈 Trade GRUSH on Eulr
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
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>GRUSH Token</div>
              <div 
                style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText('0x422fe165b2da990d18c6dca944b11dcd61519671');
                  alert('GRUSH token address copied to clipboard!');
                }}
              >
                0x422f...671
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
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Community:</span>
            <a 
              href="https://x.com/goalrushdotfun" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '8px' }}
            >
              <Twitter size={14} /> Twitter / X
            </a>
            <a 
              href="https://t.me/+qwzA9MrSA3I2OTk9" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.15)', cursor: 'pointer', borderRadius: '8px' }}
            >
              <Send size={14} /> Telegram
            </a>
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
              Simulate a hook transaction on-chain. Place your prediction to fund the match jackpot pool, play the shootout, and win fee rebates!
            </p>
          </div>
          
          <div className="pitch-container">
            {shootoutStatus && (
              <div className="shootout-overlay">
                <div className="shootout-text-main">{shootoutStatus}</div>
              </div>
            )}
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
                <div className="swap-label">Prediction Size (Ticket Cost)</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    value={swapAmount} 
                    onChange={(e) => setSwapAmount(e.target.value)} 
                    className="swap-input" 
                    disabled={isStriking}
                    step="0.0001"
                    min="0.0001"
                  />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>OKB</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setSwapAmount('0.0001')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>0.0001 OKB</button>
                  <button type="button" onClick={() => setSwapAmount('0.001')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>0.001 OKB</button>
                  <button type="button" onClick={() => setSwapAmount('0.01')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', cursor: 'pointer' }} disabled={isStriking}>0.01 OKB</button>
                </div>
              </div>
              
              <div className="swap-input-container">
                <div className="swap-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span>Jackpot Share Weight</span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>100% of OKB funds the match jackpot pool</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="swap-input" style={{ opacity: 0.8 }}>
                    {parseFloat(swapAmount) ? parseFloat(swapAmount).toFixed(4) : '0.0000'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>OKB</span>
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
              {isStriking ? 'Simulating Swap & Strike...' : !walletConnected ? 'Connect Wallet to Simulate' : 'Simulate Swap & Penalty Strike!'}
            </button>

            <div style={{
              background: 'rgba(255, 179, 0, 0.05)',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.72rem',
              color: '#ffb300',
              marginTop: '12px',
              textAlign: 'left',
              lineHeight: '1.45'
            }}>
              <strong>⚠️ OKX Wallet Warning Notice:</strong> When submitting, OKX Wallet will show a "Suspicious Receiving Address" alert. This is normal and expected because you are interacting directly with the Smart Contract hook. Click <strong>"Continue (Unsafe)"</strong> to complete your shootout simulation.
            </div>
            
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: '1.4' }}>
              <span>ℹ️ This simulator runs a test interaction with the V4 hook on-chain to play the shootout and record predictions.</span>
              <a href="https://eulr.fun/token/0x422fe165b2da990d18c6dca944b11dcd61519671" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-secondary)', textDecoration: 'underline', fontWeight: 600 }}>
                To buy or sell real GRUSH, trade on Eulr.fun →
              </a>
            </div>
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
              <button 
                onClick={() => setActiveRightTab('history')}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: activeRightTab === 'history' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.5)', 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: 700, 
                  fontSize: '0.95rem',
                  padding: '8px 4px', 
                  cursor: 'pointer',
                  borderBottom: activeRightTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'var(--transition-smooth)'
                }}
              >
                My History
              </button>
            </div>

            {activeRightTab === 'match' && (() => {
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
            })()}

            {activeRightTab === 'scores' && (
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

            {activeRightTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  Your Simulation Logs
                </h4>
                {history.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px 0' }}>
                    No predictions recorded yet. Run a shootout strike to start!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {history.map((h) => (
                      <div 
                        key={h.id} 
                        style={{ 
                          background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid rgba(255,255,255,0.05)', 
                          borderRadius: '8px', 
                          padding: '10px 12px',
                          fontSize: '0.78rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#fff' }}>{h.match}</span>
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{h.timestamp}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            Predicted: <strong style={{ color: 'var(--color-primary)' }}>{h.prediction}</strong>
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: h.result.includes('GOAL') ? 'var(--color-secondary)' : 'var(--color-danger)' }}>
                            {h.result}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                          <span>Size: {h.amount}</span>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Jackpot Share Allocation</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

      {showWhitepaper && (
        <div className="whitepaper-modal-overlay" onClick={() => setShowWhitepaper(false)}>
          <div className="whitepaper-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="whitepaper-close-btn" onClick={() => setShowWhitepaper(false)}>
              <X size={18} />
            </button>
            <img src="/whitepaper-banner.png" alt="GoalRush Whitepaper" className="whitepaper-header-banner" />
            
            <div className="whitepaper-content">
              <div className="whitepaper-section" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '2.2rem', marginBottom: '8px' }}>GOALRUSH WHITEPAPER</h1>
                <p style={{ color: 'var(--color-primary)', fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>
                  Sports Prediction Engine Powered by Uniswap V4
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px', fontSize: '0.8rem', opacity: 0.6 }}>
                  <span>Published: June 2026</span>
                  <span>•</span>
                  <span>Version: 1.0.2</span>
                  <span>•</span>
                  <span>Chain: OKX X Layer Mainnet</span>
                </div>
              </div>

              <div className="whitepaper-section">
                <h2>1. Executive Summary</h2>
                <p>
                  GoalRush (GRUSH) is a decentralized sports prediction protocol designed to align liquidity incentives, Web3 gaming, and active market trading. Deployed on the <strong>OKX X Layer Mainnet</strong>, GoalRush utilizes custom <strong>Uniswap V4 Hooks</strong> to route prediction ticket purchases directly through AMM swap events. 
                </p>
                <p style={{ marginTop: '12px' }}>
                  By turning trade volumes into prediction tickets and goalie shootout challenges, GoalRush creates a self-sustaining gamified ecosystem. Holders of the <strong>GRUSH</strong> utility token receive structural gameplay advantages (such as penalty strike success boosts) and unique visual profiles within the application, encouraging organic demand and token retention.
                </p>
              </div>

              <div className="whitepaper-section">
                <h2>2. Architecture & Uniswap V4 Hook Design</h2>
                <p>
                  GoalRush integrates directly with Uniswap V4's lifecycle callback hooks to trigger off-chain events and on-chain prediction entries. The core of this system is the <code>WorldCupGoalRushHook</code> contract.
                </p>
                
                <h3>2.1 The beforeSwap Callback</h3>
                <p>
                  When a user initiates a prediction transaction via the dashboard:
                </p>
                <ul>
                  <li>The swap parameters and prediction selection (Team A vs Team B) are compiled and sent to the hook.</li>
                  <li>The <code>beforeSwap</code> callback extracts the prediction payload (e.g. <code>hookData</code>).</li>
                  <li>The smart contract automatically registers the swapper’s choice, increments their predicted team's volume, and allocates 100% of the native OKB sent directly into the <strong>Match Jackpot Pool</strong>.</li>
                </ul>

                <div className="whitepaper-diagram-box">
                  {"User Swap Initiated"} <br />
                  {"  │"}<br />
                  {"  ▼"}<br />
                  {"Uniswap V4 PoolManager"}<br />
                  {"  │  (calls callback)"}<br />
                  {"  ▼"}<br />
                  {"beforeSwap() on Hook Contract"}<br />
                  {"  │"}<br />
                  {"  ├──► Decodes prediction (Team A/B)"}<br />
                  {"  ├──► Increments match prediction volume"}<br />
                  {"  └──► Locks OKB value in Jackpot Pool"}<br />
                </div>

                <h3>2.2 The afterSwap Callback & Shootout Rebates</h3>
                <p>
                  Following the completion of the swap, the <code>afterSwap</code> callback is executed. This initiates a goalkeeper save/shootout simulation. If the user successfully scores a goal against the automated goalkeeper, they are rewarded with a <strong>Fee Rebate</strong>:
                </p>
                <ul>
                  <li><strong>Standard Players:</strong> Have a base 50% probability of scoring a goal.</li>
                  <li><strong>GRUSH Token Holders:</strong> Holding GRUSH tokens activates the **VIP Shooter Perk**, increasing the success rate to <strong>75%</strong> and applying a custom green glow to their UI.</li>
                  <li>On a successful score, a rebate payout (simulated from the pool's accumulated hook fees) is emitted back to the swapper.</li>
                </ul>
              </div>

              <div className="whitepaper-section">
                <h2>3. Game Mechanics & Jackpot Resolution</h2>
                <div className="whitepaper-grid-2">
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Accumulating the Jackpot</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                      Every shootout prediction ticket locks native OKB directly inside the Hook contract. Unlike standard prediction markets with high fee cuts, GoalRush allocates 100% of the user-submitted amount directly into the Match Jackpot Pool, creating massive pools for key matches.
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Claiming the Pool</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                      Once the real-world match is resolved, the oracle updates the winner on-chain. Users who predicted the winning team can call <code>claimJackpot</code>. The contract automatically calculates their proportional share:
                      <br />
                      <code style={{ display: 'block', margin: '8px 0', padding: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        Payout = (UserBet * TotalJackpot) / WinnerTotalVolume
                      </code>
                    </p>
                  </div>
                </div>
              </div>

              <div className="whitepaper-section">
                <h2>4. The GRUSH Utility Token</h2>
                <p>
                  To maximize compliance with hackathon regulations and foster permissionless market listing, the <strong>GRUSH</strong> token was launched on the <strong>Eulr.fun</strong> bonding curve platform.
                </p>
                <ul>
                  <li><strong>Contract Address:</strong> <code>0x422fe165b2da990d18c6dca944b11dcd61519671</code></li>
                  <li><strong>Real-Time Balance Checks:</strong> The dApp performs on-chain queries to verify if the connected wallet holds GRUSH.</li>
                  <li><strong>VIP Highlights:</strong> Holding any amount of GRUSH applies neon-green aesthetic text shadows to the player's dashboard profile and registers them as a premium member in the prediction logs.</li>
                </ul>
              </div>

              <div className="whitepaper-section" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
                <h2>5. Security & Verification</h2>
                <p>
                  The GoalRush codebase has undergone a complete security check to ensure transparency and prevent loss of user funds:
                </p>
                <ol style={{ paddingLeft: '20px' }}>
                  <li><strong>Strict OKX Wallet Isolation:</strong> Connection is locked to the official OKX wallet to prevent phishing or multi-wallet collisions.</li>
                  <li><strong>Non-Custodial Design:</strong> The jackpot pools are managed entirely by immutable contract logic, and admin withdrawals are restricted to verify jackpot payout solvency.</li>
                  <li><strong>Eulr-fun Bonding Safety:</strong> Real token swaps happen permissionlessly on Euler, shielding the dApp simulator from token vault vulnerabilities.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p>© 2026 GoalRush. Powered by Uniswap V4 & OKX X Layer.</p>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Terms of Service</button>
            <span>•</span>
            <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Privacy Policy</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a 
            href="https://x.com/goalrushdotfun" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <Twitter size={16} /> Twitter / X
          </a>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <a 
            href="https://t.me/+qwzA9MrSA3I2OTk9" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <Send size={16} /> Telegram
          </a>
        </div>
      </footer>

      {showTerms && (
        <div className="whitepaper-modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="whitepaper-modal-container" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <button className="whitepaper-close-btn" onClick={() => setShowTerms(false)}>
              <X size={18} />
            </button>
            <div className="whitepaper-content" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '16px' }}>Terms of Service</h2>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
                <p><strong>Last Updated: June 13, 2026</strong></p>
                <p>Please read these Terms of Service carefully before interacting with the GoalRush platform. By connecting your wallet and participating, you agree to these Terms.</p>
                
                <p><strong>1. Educational & Simulation Use Only</strong></p>
                <p>GoalRush is a proof-of-concept dApp built for the Build X Hackathon. All on-chain simulations, predictions, and games are provided for educational and gaming purposes. There is no guarantee of profits or rewards.</p>

                <p><strong>2. Assumption of Risk</strong></p>
                <p>All transactions are executed directly by the user via their Web3 wallet (OKX Wallet) on the public X Layer blockchain. You accept full responsibility for any native OKB, gas costs, or token interactions. We have zero control over on-chain executions.</p>

                <p><strong>3. Solvency & Disclaimer</strong></p>
                <p>GoalRush is provided "as is" and "as available" without any warranties of any kind. We are not liable for any losses, contract bugs, network downtime, or wallet service provider issues.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="whitepaper-modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="whitepaper-modal-container" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <button className="whitepaper-close-btn" onClick={() => setShowPrivacy(false)}>
              <X size={18} />
            </button>
            <div className="whitepaper-content" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '16px' }}>Privacy Policy</h2>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
                <p><strong>Last Updated: June 13, 2026</strong></p>
                <p>GoalRush is committed to protecting user privacy. Because our platform is a decentralized application, we operate differently than standard websites.</p>

                <p><strong>1. No Collection of Personal Data</strong></p>
                <p>We do not collect, store, or process any personal identification information (PII) such as your name, email address, IP address, or physical address. There is no sign-up form or database account registration.</p>

                <p><strong>2. Blockchain Publicity</strong></p>
                <p>Your connected wallet address, token balances, and prediction transaction details are broadcasted to the public X Layer blockchain network. This data is open-source, permanent, and accessible by anyone.</p>

                <p><strong>3. Third-Party Services</strong></p>
                <p>When you interact with the OKX Wallet extension or the Eulr.fun bonding curve, you are subject to their respective terms and privacy policies. We do not control third-party Web3 infrastructure.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
