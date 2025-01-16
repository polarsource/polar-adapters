import sinon from 'https://cdn.skypack.dev/sinon@11.1.2?dts';

const mockCustomerPortalUrl = "https://mock-customer-portal-url.com";
const mockCheckoutUrl = "https://mock-checkout-url.com";
const mockSessionCreate = sinon
	.stub()
	.returns({ customerPortalUrl: mockCustomerPortalUrl });
  
const mockCheckoutCreate = sinon.stub().returns({ url: mockCheckoutUrl });

export class Polar {
  config: any;
  constructor(config: any) {
    this.config = config;
  }
  customerSessions = {
    create: mockSessionCreate,
  };

  checkouts = {
    custom: {
      create: mockCheckoutCreate,
    },
  };
}
