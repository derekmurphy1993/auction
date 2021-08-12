import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

export async function closeAuction(auction) {
    const params = {
        TableName: process.env.AUCTIONS_TABLE_NAME,
        Key: { id: auction.id},
        UpdateExpression: 'set #status = :status',
        ExpressionAttributeValues: {
            ':status': 'CLOSED',
        },
        ExpressionAttributeNames: {
            '#status': 'status',
        },
    };

    await dynamodb.update(params).promise();

    const {title, seller, highestBid } = auction;
    const { amount, bidder} = highestBid;

    if (amount === 0) {
        await sqs.sendMessage({
            QueueUrl: process.env.MAIL_QUEUE_URL,
            MessageBody: JSON.stringify({
                subject: 'Your Auction Has Closed with No Bidders',
                recipient: seller,
                body: `Sorry, Your item ${title} has not recieved any bids.`})
        }).promise();
    }

    const notifySeller = sqs.sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
            subject: 'Your Item Has Been Sold',
            recipient: seller,
            body: `WOHOOO Your item ${title} has been sold for $${amount}.`
        })
    }).promise();

    const notifyBidder = sqs.sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
            subject: 'You won an auction',
            recipient: bidder,
            body: `Good job you won the auction for ${title} for $${amount}.`
        })
    }).promise();

    return Promise.all([notifySeller, notifyBidder]);
}