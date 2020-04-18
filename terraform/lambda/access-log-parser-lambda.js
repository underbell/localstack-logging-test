console.log('Loading function');

const BUCKET_NAME = process.env.BUCKET_NAME;
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4572`,
    s3ForcePathStyle: true
});

/* nginx format patterns */
const parser = /^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>[^\"]*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^\"]*)" "(?<agent>[^\"]*)"(?:\s+(?<http_x_forwarded_for>[^ ]+))?)?$/;

exports.handler = async (event, context) => {
    let success = 0;
    let failure = 0;
    let result = new Object();

    event.Records.forEach((record) => {
        // Kinesis data is base64 encoded so decode here
        const payload = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
        const message = JSON.parse(payload).message;
        const match = message.match(parser);

        // aws athena acceptable characters : lowercase letters, numbers, and the underscore character
        if (match) {
            let data = new Object();
            data.remote = match[1];
            data.host = match[2];
            data.user = match[3];
            data.time = new Date(match[4].split(' ')[0].replace(":", " "));
            data.method = match[5];
            data.path = match[6];
            data.code = match[7];
            data.size = match[8];
            data.referer = match[9];
            data.agent = match[10];
            data.http_x_forwarded_for = match[11];
            result.data = data;
            result.status = "ok"
            success++;
        } else {
            result.data = record.kinesis.data;
            result.status = "fail"
            failure++;
        }
    });
    console.log(`Processing completed.  Successful records ${success}, Failed records ${failure}.`);

    // Upload to the destination bucket
    if(result.status == 'ok')   {
        try {
            const destparams = {
                Bucket: BUCKET_NAME,
                Key: `${result.data.time.getFullYear().toString().padStart(4, '0')}_${
                    (result.data.time.getMonth()+1).toString().padStart(2, '0')}_${
                    result.data.time.getDate().toString().padStart(2, '0')}_${
                    result.data.time.getHours().toString().padStart(2, '0')}_${
                    result.data.time.getMinutes().toString().padStart(2, '0')}_${
                    result.data.time.getSeconds().toString().padStart(2, '0')}.json`,
                Body: JSON.stringify(result.data),
                ContentType: 'application/json; charset=utf-8'
            };

            console.log('put data: ', destparams.Body);
            const putResult = await s3.putObject(destparams).promise(); 
            
        } catch (error) {
            console.log('upload fail:', error);
        } 
    }

    return { records: result };
};