//-------------------------------------------------------------------
// Enrollment HFC Library
//-------------------------------------------------------------------

module.exports = function (g_options, logger) {
	//HFC.setLogger({info: function(){}, debug: function(){}, warn: function(){}, error: function(){}});	//doesn't work
	var path = require('path');
	var common = require(path.join(__dirname, './common.js'))(logger);
	var enrollment = {};
	var User = require('fabric-client/lib/User.js');
	var CaService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
	var Orderer = require('fabric-client/lib/Orderer.js');
	var Peer = require('fabric-client/lib/Peer.js');
	var os = require('os');
	var HFC = require('fabric-client');
	var helper = g_options.helper;

	//-----------------------------------------------------------------
	// Enroll an enrollId with the ca
	//-----------------------------------------------------------------
	/*
		options = {
			peer_urls: ['array of peer grpc urls'],
			channel_id: 'channel name',
			uuid: 'unique name for this enollment',
			ca_url: 'http://urlhere:port',
			orderer_url: 'grpc://urlhere:port',
			enroll_id: 'enrollId',
			enroll_secret: 'enrollSecret',
			msp_id: 'string',
			ca_tls_opts: {
				pem: 'complete tls certificate',					<optional>
				common_name: 'common name used in pem certificate' 	<optional>
			},
			orderer_tls_opts: {
				pem: 'complete tls certificate',					<optional>
				common_name: 'common name used in pem certificate' 	<optional>
			},
			peer_tls_opts: {
				pem: 'complete tls certificate',					<optional>
				common_name: 'common name used in pem certificate' 	<optional>
			}
		}
	*/

	enrollment.enroll = function (client, cb) {
		var chain = {};
		var options = helper.makeEnrollmentOptions(0);
			try {
				chain = client.getChain(options.channel_id);
			}
			catch (e) {
				try {
					logger.info('Chain does not exist, creating a new one. Ignore the above error.')
					// If that chain doesn't exist
					chain = client.newChain(options.channel_id);
				} catch (e) {
				//it might error about 1 chain per network, but that's not a problem just continue
				}
			}

		if (!options.uuid) {
			logger.error('cannot enroll with undefined uuid');
			if (cb) cb({ error: 'cannot enroll with undefined uuid' });
			return;
		}

		var debug = {												// this is just for console printing, no PEM here
			peer_urls: options.peer_urls,
			channel_id: options.channel_id,
			uuid: options.uuid,
			ca_url: options.ca_url,
			orderer_url: options.orderer_url,
			enroll_id: options.enroll_id,
			enroll_secret: options.enroll_secret,
			msp_id: options.msp_id
		};
		logger.info('[fcw] Going to enroll for mspId ', debug);

		// Make eCert kvs (Key Value Store)
		HFC.newDefaultKeyValueStore({
			path: path.join(os.homedir(), '.hfc-key-store/' + options.uuid) //store eCert in the kvs directory
		}).then(function (store) {
			client.setStateStore(store);
			console.log('CALLING GET SUBMITTER');
			return getSubmitter(client, options);							//do most of the work here
		}).then(function (submitter) {
			console.log('SUBMITTER RETURNED');

			helper.setupOrderers(client, options.channel_id);

			helper.setupPeers(client, options.channel_id);

			helper.setPrimaryPeer(client, options.channel_id);

			// --- Success --- //
			logger.debug('[fcw] Successfully got enrollment ' + options.uuid);
			if (cb) cb(null, { client: client, chain: chain, submitter: submitter });

			return;

		}).catch(

			// --- Failure --- //
			function (err) {
				logger.error('[fcw] Failed to get enrollment ' + options.uuid, err.stack ? err.stack : err);
				var formatted = common.format_error_msg(err);

				if (cb) cb(formatted);
				return;
			}
			);
	};

	// Get Submitter - ripped this function off from fabric-client
	function getSubmitter(client, options) {
		var member;
		return client.getUserContext(options.enroll_id, true/* checkPersistence */).
		then((user) => {
			return new Promise((resolve, reject) => {
				if (user && user.isEnrolled()) {
					logger.info('[fcw] Successfully loaded member from persistence');
					return resolve(user);
				} else {

					console.log('USER DETAILS', user);

					// Need to enroll it with CA server
					var tlsOptions = {
						trustedRoots: [options.ca_tls_opts.pem],
						verify: false
					};
					var ca_client = new CaService(options.ca_url, tlsOptions, options.ca_name);
					logger.debug('id', options.enroll_id, 'secret', options.enroll_secret);
					logger.debug('msp_id', options.msp_id);
					return ca_client.enroll({
						enrollmentID: options.enroll_id,
						enrollmentSecret: options.enroll_secret

						// Store Certs
					}).then((enrollment) => {
						logger.info('[fcw] Successfully enrolled user \'' + options.enroll_id + '\'');
						member = new User(options.enroll_id, client);

						return member.setEnrollment(enrollment.key, enrollment.certificate, options.msp_id);

						// Save Submitter Enrollment
					}).then(() => {
						return client.setUserContext(member);

						// Return Submitter Enrollment
					}).then(() => {
						return resolve(member);

						// Send Errors to Callback
					}).catch((err) => {
						logger.error('[fcw] Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
						return reject(err);
	//					throw new Error('Failed to obtain an enrolled user');
					});
				}

			})
		});
	}


	return enrollment;
};
