var winston = require('winston');								//logginer module
var path = require('path');
var HFC = require('fabric-client');
var utils = require('fabric-client/lib/utils.js');
var os = require('os');
var async = require('async');

// console.log(common);

// --- Set Our Things --- //
var logger = new (winston.Logger)({
	level: 'debug',
	transports: [
		new (winston.transports.Console)({ colorize: true }),
	]
});
var helper = require(path.join(__dirname, '../utils/helper.js'))('marbles1.json', logger);			//set the config file name here
//var fcw = require(path.join(__dirname, '../utils/fc_wrangler/index.js'))({ block_delay: helper.getBlockDelay(), helper: helper }, logger);
var fcw = require('../utils/fc_wrangler/common.js')(logger);

console.log('---------------------------------------');
logger.info('Lets install some chaincode -', helper.getChaincodeId(), helper.getChaincodeVersion());
console.log('---------------------------------------');

console.log('---------------------------------------');
logger.info('We will install chaincode on ', helper.getNumPeers(), 'peers.');
console.log('---------------------------------------');

var index = 0;
async.whilst(function () {
	return index < helper.getNumPeers();
}, function (cb) {
	logger.info('Installing chaincode on peer', index);

	logger.debug('Getting HFC object');
	var client = new HFC();

	var uuid = 'marbles-' + helper.getNetworkId() + '-' + helper.getChannelId() + '-' + helper.getPeersName(index);

/*	logger.debug('Setting up default keystore');
	HFC.newDefaultKeyValueStore({
		path: path.join(os.homedir(), '.hfc-key-store/' + uuid) //store eCert in the kvs directory
	}).then((store) => {
		client.setStateStore(store);
	}).then(() => {
		logger.debug('Setting up the admin user for peer', index);
		client.createUser({
			username: 'admin',
			mspid: helper.getPeersMspId(index),
			cryptoContent: helper.getPeerAdminCerts(index)
		}).then((user) => {
			console.log(user);
*/
	helper.getAdminUser(index).then((user) => {
		client.setUserContext(user);
		return user;
	}).then((user) => {

			console.log('---------------------------------------');
			logger.info('Now we install');
			console.log('---------------------------------------');

			var userContext = user;

			// fix GOPATH - does not need to be real!
			process.env.GOPATH = path.join(__dirname, '../chaincode');
			var nonce = utils.getNonce();

			// send proposal to endorser
			var request = {
				targets: [client.newPeer(helper.getPeersUrl(index), {
					pem: helper.getPeerTLScertOpts(index).pem,
					'ssl-target-name-override': helper.getPeerTLScertOpts(index).common_name			//can be null if cert matches hostname
				})],
				chaincodePath: 'marbles',		//rel path from /server/libs/src/ to chaincode folder ex: './marbles_chaincode'
				chaincodeId: helper.getChaincodeId(),
				chaincodeVersion: helper.getChaincodeVersion(),
				txId: HFC.buildTransactionID(nonce, userContext),
				nonce: nonce
			};
			logger.debug('[fcw] Sending install req', request);

			client.installChaincode(request).then(function (results) {
				//check response
				fcw.check_proposal_res(results);
				index++;
				if (cb) return cb(null, results);
			}).catch(function (err) {
				logger.error('[fcw] Error in install catch block', typeof err, err);
				var formatted = fcw.format_error_msg(err);

				if (cb) return cb(formatted, null);
				else return;
			});
	});
/*		}).catch(function (err) {
			logger.error('[fcw] Error creating user', typeof err, err);
			var formatted = fcw.format_error_msg(err);

			if (cb) return cb(formatted, null);
			else return;
		});
	}).catch(function (err) {
		logger.error('[fcw] Error setting the keystore', typeof err, err);
		var formatted = fcw.format_error_msg(err);

		if (cb) return cb(formatted, null);
		else return;
	});
	*/
}, function (err) {
	if (err) {
		logger.error(err);
	}
});



// fcw.enroll(client, function (enrollErr, enrollResp) {
// 	console.log('ENROLL ERROR', enrollErr);
// 	if (enrollErr != null) {
// 		logger.error('error enrolling', enrollErr, enrollResp);
// 	} else {

// //		console.log('Enroll Response: ', enrollResp);
// 		console.log('---------------------------------------');
// 		logger.info('Now we install');
// 		console.log('---------------------------------------');
// 		console.log('---------------------------------------');

// 		var opts = {
// 			peer_urls: [helper.getPeersUrl(0)],
// 			path_2_chaincode: 'marbles',				//path to chaincode from <marblesroot>/chaincode/src/
// 			chaincode_id: helper.getChaincodeId(),
// 			chaincode_version: helper.getChaincodeVersion(),
// 			peer_tls_opts: helper.getPeerTLScertOpts(0)
// 		};

// 		console.log('CALLING INSTALL')
// 		fcw.install_chaincode(enrollResp, opts, function (err, resp) {
// 			console.log('---------------------------------------');
// 			logger.info('Install done. Errors:', err);
// 			console.log('---------------------------------------');

// 		});
// 	}
// });
