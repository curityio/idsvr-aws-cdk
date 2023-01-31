const aws = require('aws-sdk');

exports.handler = async (event, context) => {
  console.log('Event : ', JSON.stringify(event, null, 2));

  const ec2 = new aws.EC2({ region: event.ResourceProperties.Region });
  let responseData = {};

  if (event.RequestType == 'Delete') {
    return { ...event };
  }

  const describeImagesParams = {
    Filters: [
      { Name: 'name', Values: [event['ResourceProperties']['Name']] },
      { Name: 'architecture', Values: [event['ResourceProperties']['Architecture']] },
      { Name: 'root-device-type', Values: ['ebs'] }
    ],

    Owners: [event['ResourceProperties']['Owner']]
  };

  try {
    const imagesResult = await ec2.describeImages(describeImagesParams).promise();
    const images = imagesResult.Images;
    console.log('Found ' + images.length + ' Curity Identity Server AMIs');
    images.sort(function (x, y) {
      return new Date(y.CreationDate) - new Date(x.CreationDate);
    });

    responseData['amiId'] = images[0].ImageId;
  } catch (err) {
    responseData = { Error: 'DescribeImages call failed' };
    console.error('Failed to describe images', err);
  }

  const response = { ...event, PhysicalResourceId: context.logStreamName, Data: responseData };
  console.log('Response: ', JSON.stringify(response, null, 2));
  return response;
};
