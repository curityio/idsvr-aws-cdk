/*
 * Copyright 2023 Curity AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
