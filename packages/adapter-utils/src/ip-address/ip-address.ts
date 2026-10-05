const DEFAULT_IP_ADDRESS_HEADERS = [
	"x-forwarded-for",
	"x-real-ip",
	"cf-connecting-ip",
];

const IPV4_OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);

const isValidIpAddress = (value: string): boolean =>
	IPV4_PATTERN.test(value) ||
	(/^[0-9a-f:.]*:[0-9a-f:.]*$/i.test(value) &&
		URL.canParse(`http://[${value}]`));

export const getClientIpAddress = (
	headers: Headers | undefined,
	ipAddressHeaders: string[] | false = DEFAULT_IP_ADDRESS_HEADERS,
): string | undefined => {
	if (!headers || !ipAddressHeaders) {
		return undefined;
	}

	return ipAddressHeaders
		.map((name) => headers.get(name)?.split(",")[0]?.trim())
		.find((ip) => ip !== undefined && isValidIpAddress(ip));
};
