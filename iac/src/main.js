"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var cdktf_1 = require("cdktf");
// NOTE: .gen is at the same level as src/, so we go up one directory.
var provider_1 = require("../.gen/providers/aws/provider");
var TurboVetsStack = /** @class */ (function (_super) {
    __extends(TurboVetsStack, _super);
    function TurboVetsStack(scope, id) {
        var _a, _b, _c;
        var _this = _super.call(this, scope, id) || this;
        // Read configuration from environment variables (or .env for local)
        var environment = (_a = process.env.ENVIRONMENT) !== null && _a !== void 0 ? _a : 'dev';
        var region = (_b = process.env.AWS_REGION) !== null && _b !== void 0 ? _b : 'us-east-1';
        var serviceName = (_c = process.env.SERVICE_NAME) !== null && _c !== void 0 ? _c : 'turbovets-app';
        // AWS provider – no account ID or credentials hardcoded
        new provider_1.AwsProvider(_this, 'Aws', {
            region: region,
        });
        // Temporary outputs to validate wiring
        new cdktf_1.TerraformOutput(_this, 'config_environment', {
            value: environment,
        });
        new cdktf_1.TerraformOutput(_this, 'config_region', {
            value: region,
        });
        new cdktf_1.TerraformOutput(_this, 'config_service_name', {
            value: serviceName,
        });
        return _this;
    }
    return TurboVetsStack;
}(cdktf_1.TerraformStack));
var app = new cdktf_1.App();
new TurboVetsStack(app, 'turbovets-devops');
app.synth();
