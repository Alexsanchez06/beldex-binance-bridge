import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Link } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { Input, Button, Select } from '@components';
import { SWAP_TYPE, TYPE } from '@constants';
import config from '@config';
import styles from './styles';

const walletCreationUrl = {
  [TYPE.LOKI]: config.beldex.walletCreationUrl,
  [TYPE.BNB]: config.binance.walletCreationUrl,
};

class SwapSelection extends Component {
  state = {
    address: '',
    addressError: false,
    options: [{
      value: SWAP_TYPE.LOKI_TO_BLOKI,
      description: 'LOKI to B-LOKI',
    }, {
      value: SWAP_TYPE.BLOKI_TO_LOKI,
      description: 'B-LOKI to LOKI',
    }],
  };

  onNext = () => {
    const { address } = this.state;
    const { onNext } = this.props;

    const isValidAddress = address && address.length > 0;
    this.setState({ addressError: !isValidAddress });

    if (isValidAddress) onNext(address);
  }

  onAddressChanged = (event) => {
    this.setState({ address: event.target.value });
  }

  onSwapTypeChanged = (event) => {
    this.props.onSwapTypeChanged(event.target.value);
  }

  getAddressType = () => {
    const { swapType } = this.props;
    return swapType === SWAP_TYPE.LOKI_TO_BLOKI ? TYPE.BNB : TYPE.LOKI;
  }

  render() {
    const { swapType, loading, classes } = this.props;
    const { options, address, addressError } = this.state;

    const addressType = this.getAddressType();
    const inputLabel = addressType === TYPE.LOKI ? 'Loki Address' : 'BNB Address';
    const inputPlaceholder = addressType === TYPE.LOKI ? 'L...' : 'bnb...';

    const url = walletCreationUrl[addressType];

    return (
      <Grid item xs={ 12 } className={classes.root}>
        <Grid item xs={ 12 }>
          <Select
            fullWidth
            label="Swap Type"
            options={options}
            value={swapType}
            handleChange={this.onSwapTypeChanged}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={ 12 }>
          <Input
            fullWidth
            label={inputLabel}
            placeholder={inputPlaceholder}
            value={address}
            error={addressError}
            onChange={this.onAddressChanged}
            disabled={loading}
          />
          <Typography className={ classes.createAccount }>
            <Link href={url} target="_blank" rel="noreferrer">
              Don't have a wallet? create one
            </Link>
          </Typography>
        </Grid>
        <Grid item xs={ 12 } align='right' className={ classes.button }>
          <Button
            fullWidth
            label="Next"
            loading={loading}
            onClick={this.onNext}
          />
        </Grid>
        <Link href="/tos/BLOKIBridgeTOS.html" target="_blank">Terms of Service</Link>
      </Grid>
    );
  }
}

SwapSelection.propTypes = {
  classes: PropTypes.object.isRequired,
  swapType: PropTypes.string.isRequired,
  onSwapTypeChanged: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default withStyles(styles)(SwapSelection);
