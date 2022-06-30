// const endpoint = "https://wax-testnet.eosphere.io";//Test Net
const endpoint = "https://api.waxsweden.org";//Main Net
const dapp = "APOC";

/////////Test NET///////////
// const token = "waxapoctoken";
// const contract = "waxapocvestr";

//////////Main Net/////////////
const token = "apocalyptics";
const contract = "apoc.finance";

var loginact = "";
const pool_name = "investor";


const wax = new waxjs.WaxJS({
    rpcEndpoint: endpoint,
    tryAutoLogin: false
});
const transport = new AnchorLinkBrowserTransport();
const anchorLink = new AnchorLink({
    transport,
    chains: [{
        // chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',//Test Net
        chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',//Main Net
        nodeUrl: endpoint,
    }],
});
var anchorAuth = "owner";
var loggedIn = false;
var config_data = [];
var user_data = [];
var interval_ids = [];
var block_status;

function WalletListVisible(visible) {
    document.getElementById("walletlist").style.display = visible ?
        "block" :
        "none";
}

async function ShowToast(message) {
    Toastify({
        text: message,
        duration: 2500,
    }).showToast();

}

async function autoLogin() {
    var isAutoLoginAvailable = await wallet_isAutoLoginAvailable();
    if (isAutoLoginAvailable) {
        login();
    }
}

function selectWallet(walletType) {
    wallet_selectWallet(walletType);
    login();
}

async function logout() {
    await wallet_logout();
    location.reload();
}

async function login() {
    try {
        if (!loggedIn) {
            loggedIn = true;
            const userAccount = await wallet_login();
            loginact = userAccount;
            document.getElementById("loggedin").style.display = "block";
            document.getElementById("walletlist").style.display = "none";
            document.getElementById("acc").textContent = userAccount;
            document.getElementById("acc").style.display = "block";
            document.getElementById("header_2").style.display = "none";
            WalletListVisible(false);
            await main();
            ShowToast(userAccount + " Logged in");
            if (wallet_userAccount == contract) {
                document.getElementById("admin").style = "visibility: visible;opacity: 1;";
            } else document.getElementById("user").style = "visibility: visible;opacity: 1;";
        }
    } catch (e) {
        Toastify({
            text: e.message,
            duration: 2000,
        }).showToast();

    }
}
async function wallet_isAutoLoginAvailable() {
    var sessionList = await anchorLink.listSessions(dapp);
    if (sessionList && sessionList.length > 0) {
        useAnchor = true;
        return true;
    } else {
        useAnchor = false;
        return await wax.isAutoLoginAvailable();
    }
}

async function wallet_selectWallet(walletType) {

    loggedIn = false;
    useAnchor = walletType == "anchor";
}

async function wallet_login() {
    if (useAnchor) {
        var sessionList = await anchorLink.listSessions(dapp);
        if (sessionList && sessionList.length > 0) {
            wallet_session = await anchorLink.restoreSession(dapp);
        } else {
            wallet_session = (await anchorLink.login(dapp)).session;
        }
        wallet_userAccount = String(wallet_session.auth).split("@")[0];
        auth = String(wallet_session.auth).split("@")[1];
        anchorAuth = auth;

    } else {
        wallet_userAccount = await wax.login();
        wallet_session = wax.api;
        anchorAuth = "active";
    }
    return wallet_userAccount;
}

async function wallet_logout() {
    if (useAnchor) {
        await anchorLink.clearSessions(dapp);
    }
}

async function wallet_transact(actions) {
    if (useAnchor) {
        var result = await wallet_session.transact({
            actions: actions
        }, {
            blocksBehind: 3,
            expireSeconds: 30
        });
        result = {
            transaction_id: result.processed.id
        };
    } else {
        var result = await wallet_session.transact({
            actions: actions
        }, {
            blocksBehind: 3,
            expireSeconds: 30
        });
    }
    return result;
}
main();
async function main() {
    try {
        if (!loggedIn) autoLogin();
        else {
            config_data = await GetConfig();
            if (wallet_userAccount != contract) {
                user_data = await GetUserData();
                await PopulateUserData();
            } else {
                await PopulateAdminData();
                await GetConfigToken();
            }
        }
    } catch (e) {
        ShowToast(e.message);
    }
}

const GetConfig = async () => {
    try {
        var path = "/v1/chain/get_table_rows";
        var data = JSON.stringify({
            json: true,
            code: contract,
            scope: contract,
            table: "config",
            limit: 1000,
        });
        const response = await fetch(endpoint + path, {
            headers: {
                "Content-Type": "text/plain"
            },
            body: data,
            method: "POST",
        });
        const body = await response.json();
        var result = [];        
        if (body.rows.length != 0) {
            for (const c of body.rows) {

                // just get investor pool, can get other pool if want
                if (c.pool == pool_name) {
                    result.push({
                        contract: c.contract,
                        token_pool: c.token_pool,
                        current_token_pool: c.current_token_pool,
                        tge_rate: c.tge_rate,
                        release_period: c.release_period,
                        cliff_period: c.cliff_period,
                        users_vested: c.users_vested,
                        paused: c.pause_claim
                    });
                    break;
                }
            }
        }
        return result;
    } catch (e) {
        ShowToast(e.message);
    }
}

const GetConfigToken = async () => {
    try {
        var path = "/v1/chain/get_table_rows";
        var data = JSON.stringify({
            json: true,
            code: token,
            scope: token,
            table: "block",
            limit: 1000,
        });
        const response = await fetch(endpoint + path, {
            headers: {
                "Content-Type": "text/plain"
            },
            body: data,
            method: "POST",
        });
        const body = await response.json();    
        if (body.rows.length != 0) {
            block_status =  body.rows[0].blocktype == "0" ? false : true;
            document.getElementById("blockstats").textContent = "Current Status : " + (block_status ? " Enabled" : " Disabled");
        }
    } catch (e) {
        ShowToast(e.message);
    }
}


const GetUserData = async () => {
    try {
        var path = "/v1/chain/get_table_rows";
        var data = JSON.stringify({
            json: true,
            code: contract,
            scope: wallet_userAccount,
            table: "vesting",
            limit: 1000,
        });
        const response = await fetch(endpoint + path, {
            headers: {
                "Content-Type": "text/plain"
            },
            body: data,
            method: "POST",
        });
        const body = await response.json();
        var result = [];
        if (body.rows.length != 0) {
            var bdata = body.rows[0];
            result.push({
                user: bdata.user,
                vested_qty: bdata.quantity,
                claimed: bdata.tokens_claimed,
                start_date: bdata.start_date,
                duration: bdata.vesting_length,
                end_date: bdata.end_date,
                last_claim: bdata.last_claim,
                delay: bdata.release_delay,
                unclaimed: bdata.unclaimed
            })
        }
        return result;
    } catch (e) {
        ShowToast(e.message);
    }
}

const PopulateAdminData = async () => {
    if (config_data.length < 1) {
        document.getElementById("config_header").textContent = "No Investor Pool Exists ! Please Create Token Pool";
        document.getElementById("user_stats").style.display = "none";
    } else {
        document.getElementById("config_header").textContent = "Total APOC Investor Pool : " + parseFloat(config_data[0].token_pool).toFixed(4).toLocaleString('en-US') + " APOC  |  Current Pool : " + parseFloat(config_data[0].current_token_pool).toFixed(4).toLocaleString('en-US') + " APOC";
        document.getElementById("user_stats").style.display = "block";
        document.getElementById("user_stats").textContent = "Total Investors Vested : " + config_data[0].users_vested;
    }
}

const PopulateUserData = async () => {
    if (config_data.length < 1) {
        document.getElementById("user-config_header").textContent = "No Investor Pool Exists ! Please Contact Admin";
        document.getElementById("box").style.display = "none";
    } else if (user_data.length < 1) {
        document.getElementById("user-config_header").textContent = "Total APOC Investor Pool : " + parseFloat(config_data[0].token_pool).toFixed(4).toLocaleString('en-US') + " APOC  |  Current Pool : " + parseFloat(config_data[0].current_token_pool).toFixed(4).toLocaleString('en-US') + " APOC";
        document.getElementById("user_header").textContent = "No Vesting Record Found for this user !";
        document.getElementById("box").style.display = "none";
    } else {
        document.getElementById("user-config_header").textContent = "Total APOC Investor Pool : " + parseFloat(config_data[0].token_pool).toFixed(4).toLocaleString('en-US') + " APOC  |  Current Pool : " + parseFloat(config_data[0].current_token_pool).toFixed(4).toLocaleString('en-US') + " APOC";
        document.getElementById("user_header").textContent = "Tokens Vested For Investor " + wallet_userAccount + " : " + parseFloat(user_data[0].vested_qty).toFixed(4).toLocaleString('en-US') + " APOC";
        var percent = parseFloat((parseFloat(user_data[0].claimed) / parseFloat(user_data[0].vested_qty)) * 100).toFixed(0);
        document.getElementById("percentage").innerHTML = percent + '<span>%<span>';
        document.getElementById("claimed").textContent = "Rewards Claimed Till Now : " + parseFloat(user_data[0].claimed).toFixed(4).toLocaleString('en-US') + " APOC";
        document.getElementById("percent_circle").style = 'stroke-dashoffset:calc(440 - (440 * ' + percent + ') / 100)';
        // console.log(user_data[0].unclaimed)


        var now = new Date();

        const utcMilllisecondsSinceEpoch = now.getTime();
        const utcSecondsSinceEpoch = Math.round(utcMilllisecondsSinceEpoch / 1000);
        var delay = user_data[0].delay;
        var total_days = (config_data[0].release_period - config_data[0].cliff_period) / delay;
        var tge_release_amt = parseFloat(user_data[0].vested_qty).toFixed(4) * parseFloat(config_data[0].tge_rate / 100);
        var amount_per_day = (parseFloat(user_data[0].vested_qty).toFixed(4) - tge_release_amt) / total_days;
        var timer = parseInt((utcSecondsSinceEpoch - user_data[0].last_claim) / delay) * amount_per_day;



        if (timer > (parseFloat(user_data[0].vested_qty) - parseFloat(user_data[0].claimed))) {
            timer = (parseFloat(user_data[0].vested_qty) - parseFloat(user_data[0].claimed));
        }

        // timer = (parseFloat(timer).toFixed(4).toLocaleString('en-US') + parseFloat(user_data[0].unclaimed)) + " APOC";
        timer = (parseFloat(timer) + parseFloat(user_data[0].unclaimed)).toFixed(4).toLocaleString('en-US') + " APOC";

        var end_d = new Date(user_data[0].end_date + 'Z');
        end_d = end_d.getTime() / 1000;

        var cliff_d = new Date(user_data[0].start_date + 'Z');
        // cliff_d = (cliff_d.getTime() / 1000) + config_data[0].cliff_period - delay;
        cliff_d = (cliff_d.getTime() / 1000) + config_data[0].cliff_period;





        // console.log(utcSecondsSinceEpoch);

        if (utcSecondsSinceEpoch > end_d) {
            document.getElementById("unlocked").textContent = "Unlocked Rewards : " + timer;
            document.getElementById("locked").textContent = "Locked Rewards : " + "0.0000 APOC";
            document.getElementById("claim_time").textContent = "Next Claim In : Vesting Period Ended ! Please Claim All Unlocked Rewards";
        // } else if (utcSecondsSinceEpoch < cliff_d && cliff_d == user_data[0].last_claim) {
        } else if (utcSecondsSinceEpoch < cliff_d) {
            timer = parseFloat(user_data[0].unclaimed).toFixed(4) + " APOC";
            document.getElementById("unlocked").textContent = "Unlocked Rewards : " + timer;
            document.getElementById("locked").textContent = "Locked Rewards : " + (parseFloat(user_data[0].vested_qty).toFixed(4).toLocaleString('en-US') - parseFloat(timer).toFixed(4).toLocaleString('en-US') - parseFloat(user_data[0].claimed).toFixed(4).toLocaleString('en-US')) + " APOC";
            var claim_date = new Date(((new Date(user_data[0].start_date + 'Z').getTime() / 1000) + config_data[0].cliff_period) * 1000);
            document.getElementById("claim_time").textContent = "Next Claim In : Cliff Period Ends on " + claim_date;
        } else {
            document.getElementById("unlocked").textContent = "Unlocked Rewards : " + timer;
            document.getElementById("locked").textContent = "Locked Rewards : " + (parseFloat(user_data[0].vested_qty).toFixed(4) - parseFloat(timer).toFixed(4).toLocaleString('en-US') - parseFloat(user_data[0].claimed).toFixed(4).toLocaleString('en-US')) + " APOC";

            var next_claim = utcSecondsSinceEpoch - user_data[0].last_claim;
            if(next_claim >= delay){
                next_claim = 0;
            }else{
                next_claim = delay - next_claim;
            }
            
            // console.log(next_claim);            
            startTimer(next_claim, "claim_time");
        }
    }
}

const startTimer = async (duration, index) => {

    var timer = Math.abs(duration),
        minutes, seconds;
    var new_interval = setInterval(function () {
        hours = parseInt(timer / 3600, 10)
        minutes = parseInt((timer - hours * 3600) / 60, 10);
        seconds = parseInt(timer % 60, 10);
        hours = hours < 10 ? "0" + hours : hours;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        display = hours + ":" + minutes + ":" + seconds;
        if (display == "00:00:00")
            display = "Claim Now :)";
        if (document.getElementById(index) != 'undefined' || document.getElementById(index) != 'null') {
            document.getElementById(index).textContent = "Next Claim In : " + display;
        }
        if (--timer < 0) {
            timer = 0;
        }
    }, 1000);
    interval_ids.push(new_interval);
}

const claim = async () => {
    try {
        var data1 = {
            user: wallet_userAccount
        };
        var action_name = "claim";
        await wallet_transact([{
            account: contract,
            name: action_name,
            authorization: [{
                actor: wallet_userAccount,
                permission: anchorAuth
            }],
            data: data1,
        }, ]);
        for (const ids of interval_ids) {
            clearInterval(ids);
        }
        ShowToast("Claim SuccessFull !");
        await main();
    } catch (e) {
        ShowToast(e.message);
    }
}

const createVesting = async () => {
    start_date = document.getElementById("start-date").value + "T00:00:00";
    qty = document.getElementById("vest-qty").value;
    release = document.getElementById("vest-delay").value;
    user = document.getElementById("vest-wallet").value;
    if (document.getElementById("start-date").value != "" || pool_name != "" || qty != "" || release != "" || user != "") {
        qty = parseFloat(qty).toFixed(4) + " APOC";
        var release_string = release.split(' ');
        if (release_string.length < 2) {
            if (release_string[0] != "Daily") {
                ShowToast("Check for Days and Month");
                return;
            } else release_string[0] = 86400;
        } else {
            switch (release_string[1]) {
                case "Month":
                    release_string[0] = 86400 * 30 * release_string[0];
                    break;
                case "Months":
                    release_string[0] = 86400 * 30 * release_string[0];
                    break;
                case "Day":
                    release_string[0] = 86400 * release_string[0];
                    break;
                case "Days":
                    release_string[0] = 86400 * release_string[0];
                    break;
                case "Hour":
                    release_string[0] = 3600 * release_string[0];
                    break;
                case "Hours":
                    release_string[0] = 3600 * release_string[0];
                    break;
                case "Minute":
                    release_string[0] = 60 * release_string[0];
                    break;
                case "Minutes":
                    release_string[0] = 60 * release_string[0];
                    break;
                default:
                    ShowToast("Check for Release Frequency !");
                    return;
            }
        }
        var data1 = {
            pool: pool_name,
            user: user,
            quantity: qty,
            start_date: start_date,
            release_delay: release_string[0]

        };
        var action_name = "create";
        await wallet_transact([{
            account: contract,
            name: action_name,
            authorization: [{
                actor: wallet_userAccount,
                permission: anchorAuth
            }],
            data: data1,
        }, ]);
        ShowToast("Vesting Created Successfully !");
        await main();
    } else {
        ShowToast("Please Enter All details !");
        return;
    }
}

const cancel = async () => {
    try {
        user = document.getElementById("cancel-wallet").value;
        if (user == "") return;
        var data1 = {
            user: user
        };
        var action_name = "cancel";
        await wallet_transact([{
            account: contract,
            name: action_name,
            authorization: [{
                actor: wallet_userAccount,
                permission: anchorAuth
            }],
            data: data1,
        }, ]);
        ShowToast("Vesting Cancelled SuccessFully !");
        await main();
    } catch (e) {
        ShowToast(e.message);
    }
}


const block = async () => {
    try {
        var checked = document.getElementById("block_check").checked;
        var data1 = {
            user: loginact,
            blockbool: checked
        };
        console.log(data1);

        var action_name = "blocktransfr";
        await wallet_transact([{
            account: token,
            name: action_name,
            authorization: [{
                actor: wallet_userAccount,
                permission: anchorAuth
            }],
            data: data1,
        }, ]);
        ShowToast("Transfer Status Changed !");
        await main();
    } catch (e) {
        ShowToast(e.message);
    }
}

const createpool = async () => {
    try {
        pool = document.getElementById("pool_name").value;
        qty = document.getElementById("pool_qty").value;
        tge = document.getElementById("pool_tge").value;
        release = document.getElementById("pool_release").value;
        cliff = document.getElementById("pool_cliff").value;
        checked = document.getElementById("pool_check").checked;
        if (pool_name != "" || qty != "" || tge != "" || release != "" || cliff != "" || checked != "") {
            qty = parseFloat(qty).toFixed(4) + " APOC";
            tge = parseInt(tge);
            var release_string = release.split(' ');
            var cliff_string = cliff.split(' ');
            if (!(release_string[1] == "Minutes" || 
                            cliff_string[1] == "Minutes" ||
                            release_string[1] == "Hour" || 
                            cliff_string[1] == "Hour" ||
                            release_string[1] == "Hours" || 
                            cliff_string[1] == "Hours" ||
                            release_string[1] == "Day" || 
                            cliff_string[1] == "Day" ||
                            release_string[1] == "Days" || 
                            cliff_string[1] == "Days" ||
                            release_string[1] == "Month" || 
                            cliff_string[1] == "Month" ||
                            release_string[1] == "Months" || 
                            cliff_string[1] == "Months")) {
                ShowToast("Please check for Period Units !");
                return;
            }

            var release_rate = 1;
            var cliff_rate = 1;

            if(release_string[1] == "Minutes") release_rate = 60;
            else if(release_string[1] == "Hour" || release_string[1] == "Hours") release_rate = 3600;
            else if(release_string[1] == "Day" || release_string[1] == "Days") release_rate = 86400;
            else if(release_string[1] == "Month" || release_string[1] == "Months") release_rate = 86400 * 30;

            if(cliff_string[1] == "Minutes") cliff_rate = 60;
            else if(cliff_string[1] == "Hour" || cliff_string[1] == "Hours") cliff_rate = 3600;
            else if(cliff_string[1] == "Day" || cliff_string[1] == "Days") cliff_rate = 86400;
            else if(cliff_string[1] == "Month" || cliff_string[1] == "Months") cliff_rate = 86400 * 30;
            

            var data1 = {
                pool: pool,
                token_pool: qty,
                tge_rate: tge,
                release_period: (release_string[0] * release_rate),
                cliff_period: (cliff_string[0] * cliff_rate),
                pause_claim: checked

            };
            console.log(data1);
            var action_name = "addconfig";
            await wallet_transact([{
                account: contract,
                name: action_name,
                authorization: [{
                    actor: wallet_userAccount,
                    permission: anchorAuth
                }],
                data: data1,
            }, ]);
            ShowToast("Pool Created Successfully !");
            await main();
        } else {
            ShowToast("Please Enter All details !");
            return;
        }
    } catch (e) {
        console.log(e);
        ShowToast(e.message);
    }
}